import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Image, 
  SafeAreaView as RNSafeAreaView, 
  Dimensions,
  Animated,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Keyboard
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { 
  Camera as CameraIcon, 
  RotateCcw, 
  Zap, 
  ZapOff, 
  X, 
  Check, 
  Image as ImageIcon,
  Circle,
  Send,
  Languages,
  AlertCircle,
  MessageSquare,
  ChevronLeft,
  Leaf,
  Mic,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Plus,
  Paperclip
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { askImage, askText, askAudio } from './lib/api';

const { width, height } = Dimensions.get('window');

const LANGUAGES = [
  { id: 'fr', label: 'FR' },
  { id: 'en', label: 'EN' },
  { id: 'ha', label: 'HA' },
  { id: 'ff', label: 'FF' },
];

function AudioBubble({ uri, isUser }) {
  const [sound, setSound] = useState();
  const [isPlaying, setIsPlaying] = useState(false);

  async function playSound() {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (e) {
      console.error('Error playing sound', e);
    }
  }

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  const iconColor = isUser ? "#fff" : "#007AFF";
  const waveColor = isUser ? "rgba(255,255,255,0.5)" : "rgba(0,122,255,0.3)";

  return (
    <TouchableOpacity style={styles.audioBubble} onPress={playSound}>
      {isPlaying ? <Pause color={iconColor} size={20} fill={iconColor} /> : <Play color={iconColor} size={20} fill={iconColor} />}
      <View style={styles.audioWaveform}>
        <View style={[styles.waveBar, { height: 10, backgroundColor: waveColor }]} />
        <View style={[styles.waveBar, { height: 20, backgroundColor: waveColor }]} />
        <View style={[styles.waveBar, { height: 15, backgroundColor: waveColor }]} />
        <View style={[styles.waveBar, { height: 25, backgroundColor: waveColor }]} />
        <View style={[styles.waveBar, { height: 12, backgroundColor: waveColor }]} />
      </View>
    </TouchableOpacity>
  );
}

function ChatScreen({ onBack, targetLang, setTargetLang, returnAudio, setReturnAudio }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef();
  const cameraRef = useRef();

  const addMessage = (text, sender, type = 'text', data = null) => {
    const newMessage = {
      id: Date.now(),
      text,
      sender,
      type,
      data,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    addMessage(text, 'user');
    setIsTyping(true);

    try {
      const response = await askText(text, targetLang, returnAudio);
      addMessage(response.answer_text, 'ai', 'text', { 
        disease: response.detected_disease,
        audio_url: response.audio_url 
      });
    } catch (e) {
      alert(e.message);
    } finally {
      setIsTyping(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      addMessage('Photo from gallery', 'user', 'image', { uri });
      setIsTyping(true);
      try {
        const response = await askImage(uri, targetLang, returnAudio);
        addMessage(response.answer_text, 'ai', 'text', { 
          disease: response.detected_disease,
          audio_url: response.audio_url 
        });
      } catch (e) {
        alert(e.message);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      setCameraVisible(false);
      addMessage('Photo taken', 'user', 'image', { uri: photo.uri });
      setIsTyping(true);
      try {
        const response = await askImage(photo.uri, targetLang, returnAudio);
        addMessage(response.answer_text, 'ai', 'text', { 
          disease: response.detected_disease,
          audio_url: response.audio_url 
        });
      } catch (e) {
        alert(e.message);
      } finally {
        setIsTyping(false);
      }
    }
  };

  async function startRecording() {
    try {
      if (recording) {
        try { await recording.stopAndUnloadAsync(); } catch (e) {}
        setRecording(null);
      }
      
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const RECORDING_OPTIONS = {
        android: {
          extension: '.ogg',
          outputFormat: Audio.AndroidOutputFormat.OGG,
          audioEncoder: Audio.AndroidAudioEncoder.OPUS,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      setRecording(null);
    }
  }

  async function stopRecording() {
    if (!recording) return; // Fixes "Recorder does not exist"
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      addMessage('Voice message', 'user', 'audio', { uri });
      setIsTyping(true);

      const response = await askAudio(uri, targetLang, returnAudio);
      addMessage(response.answer_text, 'ai', 'text', { 
        disease: response.detected_disease,
        audio_url: response.audio_url 
      });
    } catch (e) {
      alert(e.message);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 90}
      style={styles.container}
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={onBack}>
            <ChevronLeft color="#007AFF" size={28} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>FarmAI Expert</Text>
            <Text style={styles.headerStatus}>online</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setReturnAudio(!returnAudio)} style={styles.headerActionIcon}>
              {returnAudio ? <Volume2 color="#4ADE80" size={22} /> : <VolumeX color="#8E8E93" size={22} />}
            </TouchableOpacity>
            <View style={styles.miniLangSelector}>
              {LANGUAGES.map(lang => (
                <TouchableOpacity 
                  key={lang.id} 
                  onPress={() => setTargetLang(lang.id)}
                  style={[styles.miniLangItem, targetLang === lang.id && styles.miniLangItemActive]}
                >
                  <Text style={[styles.miniLangText, targetLang === lang.id && styles.miniLangTextActive]}>{lang.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Chat Scroll Area */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          onContentSizeChange={() => scrollViewRef.current.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.welcomeCard}>
                <Leaf color="#4ADE80" size={40} style={{ marginBottom: 12 }} />
                <Text style={styles.welcomeTitle}>Welcome to FarmAI!</Text>
                <Text style={styles.welcomeText}>Ask anything about your crops, send a photo for disease detection, or record a voice message.</Text>
              </View>
            </View>
          )}
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.messageRow, msg.sender === 'ai' ? styles.aiRow : styles.userRow]}>
              <View style={[styles.bubble, msg.sender === 'ai' ? styles.aiBubble : styles.userBubble]}>
                {msg.type === 'image' && <Image source={{ uri: msg.data.uri }} style={styles.bubbleImage} />}
                {msg.type === 'audio' && <AudioBubble uri={msg.data.uri} isUser={msg.sender === 'user'} />}
                {msg.data?.disease && (
                  <View style={styles.diseaseBadge}>
                    <AlertCircle color="#FF4B4B" size={14} />
                    <Text style={styles.diseaseText}>{msg.data.disease}</Text>
                  </View>
                )}
                <Text style={[styles.messageText, msg.sender === 'user' ? styles.userText : styles.aiText]}>{msg.text}</Text>
                {msg.data?.audio_url && (
                  <View style={styles.aiAudioContainer}>
                    <AudioBubble uri={`https://acia-production.up.railway.app${msg.data.audio_url}`} isUser={false} />
                  </View>
                )}
                <Text style={[styles.timestamp, msg.sender === 'user' ? styles.userTimestamp : styles.aiTimestamp]}>{msg.timestamp}</Text>
              </View>
            </View>
          ))}
          {isTyping && (
            <View style={styles.typingContainer}>
              <ActivityIndicator size="small" color="#8E8E93" />
              <Text style={styles.typingText}>Expert is thinking...</Text>
            </View>
          )}
        </ScrollView>

        {/* Unified Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.inputAction} onPress={() => setCameraVisible(true)}>
            <CameraIcon color="#007AFF" size={26} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inputAction} onPress={pickImage}>
            <Plus color="#007AFF" size={26} />
          </TouchableOpacity>
          
          <View style={styles.textInputContainer}>
            <TextInput 
              style={styles.inputField}
              placeholder={isRecording ? "Recording..." : "Message"}
              placeholderTextColor="#8E8E93"
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!isRecording}
            />
          </View>

          {inputText.trim().length > 0 ? (
            <TouchableOpacity style={styles.sendIcon} onPress={handleSendText}>
              <Send color="#fff" size={20} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.micIcon, isRecording && styles.micIconActive]} 
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Mic color="#fff" size={22} />
            </TouchableOpacity>
          )}
        </View>

        {/* Camera Modal */}
        <Modal visible={cameraVisible} animationType="slide">
          <View style={styles.cameraContainer}>
            <CameraView style={styles.fullCamera} ref={cameraRef} />
            <SafeAreaView style={styles.cameraOverlay}>
              <TouchableOpacity style={styles.closeCamera} onPress={() => setCameraVisible(false)}>
                <X color="#fff" size={32} />
              </TouchableOpacity>
              <View style={styles.cameraFooter}>
                <View style={{ width: 44 }} />
                <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
                  <View style={styles.captureInner} />
                </TouchableOpacity>
                <View style={{ width: 44 }} />
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [targetLang, setTargetLang] = useState('fr');
  const [returnAudio, setReturnAudio] = useState(true);

  if (screen === 'home') {
    return (
      <SafeAreaProvider>
        <View style={styles.homeContainer}>
          <StatusBar style="dark" />
          <View style={styles.homeHeader}>
            <Leaf color="#4ADE80" size={80} />
            <Text style={styles.homeTitle}>FarmAI</Text>
            <Text style={styles.homeDesc}>Intelligent tomato crop advisor</Text>
          </View>
          <TouchableOpacity style={styles.startChatButton} onPress={() => setScreen('chat')}>
            <MessageSquare color="#fff" size={24} />
            <Text style={styles.startChatText}>Start Consultation</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ChatScreen 
        onBack={() => setScreen('home')} 
        targetLang={targetLang} 
        setTargetLang={setTargetLang}
        returnAudio={returnAudio}
        setReturnAudio={setReturnAudio}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  homeContainer: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 40 },
  homeHeader: { alignItems: 'center', marginBottom: 60 },
  homeTitle: { color: '#000', fontSize: 42, fontWeight: '800', marginTop: 20 },
  homeDesc: { color: '#8E8E93', fontSize: 16, marginTop: 8, textAlign: 'center' },
  startChatButton: { backgroundColor: '#4ADE80', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 18, borderRadius: 30, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  startChatText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', backgroundColor: '#FFFFFF' },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { color: '#000', fontSize: 18, fontWeight: '700' },
  headerStatus: { color: '#4ADE80', fontSize: 12, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerActionIcon: { padding: 4 },
  miniLangSelector: { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 15, padding: 2 },
  miniLangItem: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 13 },
  miniLangItemActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  miniLangText: { color: '#8E8E93', fontSize: 10, fontWeight: '700' },
  miniLangTextActive: { color: '#000' },

  messageList: { flex: 1, backgroundColor: '#F2F2F7' },
  messageListContent: { padding: 16, gap: 12 },
  messageRow: { width: '100%', marginBottom: 4 },
  userRow: { alignItems: 'flex-end' },
  aiRow: { alignItems: 'flex-start' },
  bubble: { padding: 12, borderRadius: 20, maxWidth: '85%', position: 'relative' },
  userBubble: { backgroundColor: '#4ADE80' },
  aiBubble: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22 },
  userText: { color: '#fff' },
  aiText: { color: '#000' },
  bubbleImage: { width: 240, height: 180, borderRadius: 12, marginBottom: 8 },
  timestamp: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  userTimestamp: { color: 'rgba(255,255,255,0.7)' },
  aiTimestamp: { color: '#8E8E93' },
  
  audioBubble: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  audioWaveform: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  waveBar: { width: 3, borderRadius: 1.5 },
  aiAudioContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F2F2F7' },
  
  diseaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,75,75,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginBottom: 8 },
  diseaseText: { color: '#FF4B4B', fontSize: 13, fontWeight: '700' },

  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  inputAction: { padding: 4 },
  textInputContainer: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  inputField: { color: '#000', fontSize: 16, maxHeight: 100 },
  sendIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  micIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  micIconActive: { backgroundColor: '#FF3B30' },

  typingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  typingText: { color: '#8E8E93', fontSize: 13 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  welcomeCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, width: '90%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  welcomeTitle: { color: '#000', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  welcomeText: { color: '#8E8E93', textAlign: 'center', lineHeight: 22 },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  fullCamera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  closeCamera: { alignSelf: 'flex-start', margin: 24 },
  cameraFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 40 },
  captureButton: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
});
