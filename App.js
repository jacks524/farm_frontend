import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera as CameraIcon,
  X,
  Send,
  AlertCircle,
  MessageSquare,
  ChevronLeft,
  Leaf,
  Mic,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  Sprout,
  ShieldCheck,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { askImage, askText, askAudio, API_BASE_URL } from './lib/api';

const COLORS = {
  primary: '#22C55E',
  primaryLight: '#4ADE80',
  primaryDark: '#16A34A',
  primaryBg: '#F0FDF4',
  chatBg: '#F1F5F9',
  white: '#FFFFFF',
  dark: '#111827',
  gray: '#6B7280',
  grayLight: '#E5E7EB',
  grayBg: '#F9FAFB',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  warning: '#F59E0B',
  blue: '#3B82F6',
};

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

const LANGUAGES = [
  { id: 'fr', label: 'FR' },
  { id: 'en', label: 'EN' },
  { id: 'ha', label: 'HA' },
  { id: 'ff', label: 'FF' },
];

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - i * 150),
        ])
      )
    );
    Animated.parallel(animations).start();
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.typingBubble}>
      <View style={styles.aiAvatar}>
        <Leaf color={COLORS.white} size={12} />
      </View>
      <View style={styles.dotsContainer}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
          />
        ))}
      </View>
    </View>
  );
}

function AudioBubble({ uri, isUser }) {
  const [sound, setSound] = useState();
  const [isPlaying, setIsPlaying] = useState(false);
  const BARS = [6, 14, 10, 18, 8, 16, 11];

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
      const { sound: newSound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      setSound(newSound);
      setIsPlaying(true);
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) setIsPlaying(false);
      });
    } catch (e) {
      console.error('Error playing sound', e);
    }
  }

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  const iconColor = isUser ? COLORS.white : COLORS.primary;
  const waveColor = isUser ? 'rgba(255,255,255,0.6)' : COLORS.primaryLight;

  return (
    <TouchableOpacity style={styles.audioBubble} onPress={playSound} activeOpacity={0.8}>
      <View style={[styles.playBtn, { backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : COLORS.primaryBg }]}>
        {isPlaying
          ? <Pause color={iconColor} size={16} fill={iconColor} />
          : <Play color={iconColor} size={16} fill={iconColor} />}
      </View>
      <View style={styles.audioWaveform}>
        {BARS.map((h, i) => (
          <View key={i} style={[styles.waveBar, { height: h, backgroundColor: waveColor }]} />
        ))}
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
  const isStartingRecording = useRef(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const scrollViewRef = useRef();
  const cameraRef = useRef();

  const addMessage = (text, sender, type = 'text', data = null) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      text,
      sender,
      type,
      data,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    addMessage(text, 'user');
    setIsTyping(true);
    try {
      const response = await askText(text, targetLang, returnAudio);
      addMessage(response.answer_text, 'ai', 'text', { disease: response.detected_disease, audio_url: response.audio_url });
    } catch (e) {
      addMessage(e.message || 'Une erreur est survenue.', 'ai', 'error');
    } finally {
      setIsTyping(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.5 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      addMessage('', 'user', 'image', { uri });
      setIsTyping(true);
      try {
        const response = await askImage(uri, targetLang, returnAudio);
        addMessage(response.answer_text, 'ai', 'text', { disease: response.detected_disease, audio_url: response.audio_url });
      } catch (e) {
        addMessage(e.message || 'Une erreur est survenue.', 'ai', 'error');
      } finally {
        setIsTyping(false);
      }
    }
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      setCameraVisible(false);
      addMessage('', 'user', 'image', { uri: photo.uri });
      setIsTyping(true);
      try {
        const response = await askImage(photo.uri, targetLang, returnAudio);
        addMessage(response.answer_text, 'ai', 'text', { disease: response.detected_disease, audio_url: response.audio_url });
      } catch (e) {
        addMessage(e.message || 'Une erreur est survenue.', 'ai', 'error');
      } finally {
        setIsTyping(false);
      }
    }
  };

  async function startRecording() {
    if (isStartingRecording.current) return;
    isStartingRecording.current = true;
    try {
      if (recording) {
        try { await recording.stopAndUnloadAsync(); } catch (e) {}
        setRecording(null);
      }
      const { status } = await Audio.getPermissionsAsync();
      if (status !== 'granted') await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false, staysActiveInBackground: false });
      const { recording: newRecording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      setRecording(null);
      setIsRecording(false);
      addMessage(err.message || "Impossible d'activer le microphone.", 'ai', 'error');
    } finally {
      isStartingRecording.current = false;
    }
  }

  async function stopRecording() {
    if (!recording || isStartingRecording.current) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      addMessage('', 'user', 'audio', { uri });
      setIsTyping(true);
      const response = await askAudio(uri, targetLang, returnAudio);
      addMessage(response.answer_text, 'ai', 'text', { disease: response.detected_disease, audio_url: response.audio_url });
    } catch (e) {
      addMessage(e.message || 'Une erreur est survenue.', 'ai', 'error');
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 90} style={{ flex: 1, backgroundColor: COLORS.white }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <ChevronLeft color={COLORS.dark} size={22} />
          </TouchableOpacity>
          <View style={styles.aiAvatarHeader}>
            <Leaf color={COLORS.white} size={18} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>FarmAI Expert</Text>
            <View style={styles.headerStatusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.headerStatus}>En ligne</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setReturnAudio(!returnAudio)} style={styles.headerIconBtn}>
              {returnAudio
                ? <Volume2 color={COLORS.primary} size={20} />
                : <VolumeX color={COLORS.gray} size={20} />}
            </TouchableOpacity>
            <View style={styles.langPills}>
              {LANGUAGES.map(lang => (
                <TouchableOpacity key={lang.id} onPress={() => setTargetLang(lang.id)} style={[styles.langPill, targetLang === lang.id && styles.langPillActive]}>
                  <Text style={[styles.langPillText, targetLang === lang.id && styles.langPillTextActive]}>{lang.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView ref={scrollViewRef} style={styles.messageList} contentContainerStyle={styles.messageListContent} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })} showsVerticalScrollIndicator={false}>

          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Leaf color={COLORS.primary} size={36} />
              </View>
              <Text style={styles.emptyTitle}>Bonjour ! 👋</Text>
              <Text style={styles.emptySubtitle}>Je suis votre expert agricole IA. Posez-moi une question, envoyez une photo de vos cultures ou un message vocal.</Text>
              <View style={styles.hintRow}>
                <View style={styles.hintChip}><CameraIcon color={COLORS.primary} size={14} /><Text style={styles.hintText}>Photo</Text></View>
                <View style={styles.hintChip}><Mic color={COLORS.primary} size={14} /><Text style={styles.hintText}>Vocal</Text></View>
                <View style={styles.hintChip}><MessageSquare color={COLORS.primary} size={14} /><Text style={styles.hintText}>Texte</Text></View>
              </View>
            </View>
          )}

          {messages.map((msg) => (
            <View key={msg.id} style={[styles.messageRow, msg.sender === 'ai' ? styles.aiRow : styles.userRow]}>
              {msg.sender === 'ai' && (
                <View style={styles.aiAvatar}>
                  <Leaf color={COLORS.white} size={12} />
                </View>
              )}
              <View style={[
                styles.bubble,
                msg.sender === 'ai' ? styles.aiBubble : styles.userBubble,
                msg.type === 'error' && styles.errorBubble,
              ]}>
                {msg.type === 'image' && <Image source={{ uri: msg.data.uri }} style={styles.bubbleImage} />}
                {msg.type === 'audio' && <AudioBubble uri={msg.data.uri} isUser={msg.sender === 'user'} />}
                {msg.data?.disease && (
                  <View style={styles.diseaseBadge}>
                    <AlertCircle color={COLORS.error} size={13} />
                    <Text style={styles.diseaseText}>{msg.data.disease}</Text>
                  </View>
                )}
                {msg.text ? <Text style={[styles.messageText, msg.sender === 'user' ? styles.userText : msg.type === 'error' ? styles.errorText : styles.aiText]}>{msg.text}</Text> : null}
                {msg.data?.audio_url && (
                  <View style={styles.aiAudioContainer}>
                    <AudioBubble uri={`${API_BASE_URL}${msg.data.audio_url}`} isUser={false} />
                  </View>
                )}
                <Text style={[styles.timestamp, msg.sender === 'user' ? styles.userTimestamp : styles.aiTimestamp]}>{msg.timestamp}</Text>
              </View>
            </View>
          ))}

          {isTyping && <TypingDots />}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.inputActionBtn} onPress={() => setCameraVisible(true)}>
            <CameraIcon color={COLORS.primary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inputActionBtn} onPress={pickImage}>
            <ImageIcon color={COLORS.primary} size={20} />
          </TouchableOpacity>
          <View style={[styles.textInputWrap, isRecording && styles.textInputRecording]}>
            <TextInput
              style={styles.inputField}
              placeholder={isRecording ? '🎙 Enregistrement...' : 'Message...'}
              placeholderTextColor={isRecording ? COLORS.error : COLORS.gray}
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!isRecording}
              onSubmitEditing={handleSendText}
            />
          </View>
          {inputText.trim().length > 0 ? (
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendText} activeOpacity={0.85}>
              <Send color={COLORS.white} size={18} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.micBtn, isRecording && styles.micBtnActive]} onPressIn={startRecording} onPressOut={stopRecording} activeOpacity={0.85}>
              <Mic color={COLORS.white} size={18} />
            </TouchableOpacity>
          )}
        </View>

        {/* Camera Modal */}
        <Modal visible={cameraVisible} animationType="slide">
          <View style={styles.cameraContainer}>
            <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />
            <SafeAreaView style={styles.cameraOverlay}>
              <TouchableOpacity style={styles.closeCameraBtn} onPress={() => setCameraVisible(false)}>
                <X color={COLORS.white} size={24} />
              </TouchableOpacity>
              <View style={styles.cameraFooter}>
                <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
                  <View style={styles.captureInner} />
                </TouchableOpacity>
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
        <StatusBar style="dark" />
        <SafeAreaView style={styles.homeContainer} edges={['top', 'bottom']}>
          {/* Decorative bg circles */}
          <View style={styles.bgCircle1} />
          <View style={styles.bgCircle2} />

          <View style={styles.homeContent}>
            {/* Logo */}
            <View style={styles.logoWrap}>
              <View style={styles.logoRing}>
                <View style={styles.logoCore}>
                  <Leaf color={COLORS.white} size={40} />
                </View>
              </View>
            </View>

            <Text style={styles.homeTitle}>FarmAI</Text>
            <Text style={styles.homeTagline}>Conseiller agricole intelligent</Text>

            {/* Feature list */}
            <View style={styles.featureList}>
              {[
                { icon: <CameraIcon color={COLORS.primary} size={18} />, label: 'Détection de maladies par photo' },
                { icon: <Mic color={COLORS.primary} size={18} />, label: 'Questions vocales multilingues' },
                { icon: <ShieldCheck color={COLORS.primary} size={18} />, label: 'Conseils d\'experts certifiés' },
              ].map((f, i) => (
                <View key={i} style={styles.featureItem}>
                  <View style={styles.featureIcon}>{f.icon}</View>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.startBtn} onPress={() => setScreen('chat')} activeOpacity={0.85}>
            <MessageSquare color={COLORS.white} size={20} />
            <Text style={styles.startBtnText}>Démarrer une consultation</Text>
          </TouchableOpacity>

          <Text style={styles.homeFooter}>FR · EN · HA · FF</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ChatScreen onBack={() => setScreen('home')} targetLang={targetLang} setTargetLang={setTargetLang} returnAudio={returnAudio} setReturnAudio={setReturnAudio} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // ── Home ──────────────────────────────────────────
  homeContainer: { flex: 1, backgroundColor: COLORS.white, paddingHorizontal: 28 },
  bgCircle1: { position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: COLORS.primaryBg },
  bgCircle2: { position: 'absolute', bottom: 100, left: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: COLORS.primaryBg },
  homeContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoWrap: { marginBottom: 24, alignItems: 'center' },
  logoRing: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.grayLight },
  logoCore: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 },
  homeTitle: { fontSize: 44, fontWeight: '800', color: COLORS.dark, letterSpacing: -1 },
  homeTagline: { fontSize: 16, color: COLORS.gray, marginTop: 6, marginBottom: 36, textAlign: 'center' },
  featureList: { width: '100%', gap: 12 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.grayBg, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' },
  featureLabel: { fontSize: 14, color: COLORS.dark, fontWeight: '500', flex: 1 },
  startBtn: { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 18, marginBottom: 16, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  startBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  homeFooter: { textAlign: 'center', color: COLORS.gray, fontSize: 12, marginBottom: 8, letterSpacing: 2 },

  // ── Chat Header ──────────────────────────────────
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.grayBg, justifyContent: 'center', alignItems: 'center' },
  aiAvatarHeader: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  headerStatus: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.grayBg, justifyContent: 'center', alignItems: 'center' },
  langPills: { flexDirection: 'row', backgroundColor: COLORS.grayBg, borderRadius: 10, padding: 2 },
  langPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  langPillActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  langPillText: { fontSize: 10, fontWeight: '700', color: COLORS.gray },
  langPillTextActive: { color: COLORS.dark },

  // ── Messages ─────────────────────────────────────
  messageList: { flex: 1, backgroundColor: COLORS.chatBg },
  messageListContent: { padding: 16, gap: 8, paddingBottom: 20 },

  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 16 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: COLORS.grayLight },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: COLORS.dark, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  hintRow: { flexDirection: 'row', gap: 8 },
  hintChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: COLORS.grayLight },
  hintText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },

  aiAvatar: { width: 28, height: 28, borderRadius: 9, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },

  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  userBubble: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  errorBubble: { backgroundColor: COLORS.errorBg, borderWidth: 1, borderColor: '#FECACA' },

  diseaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, marginBottom: 7, borderWidth: 1, borderColor: '#FECACA' },
  diseaseText: { color: COLORS.error, fontSize: 12, fontWeight: '700', flex: 1 },

  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: COLORS.white },
  aiText: { color: COLORS.dark },
  errorText: { color: COLORS.error },

  bubbleImage: { width: 220, height: 165, borderRadius: 10, marginBottom: 4 },
  timestamp: { fontSize: 10, alignSelf: 'flex-end', marginTop: 5 },
  userTimestamp: { color: 'rgba(255,255,255,0.65)' },
  aiTimestamp: { color: COLORS.gray },
  aiAudioContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.grayLight },

  // ── Typing ───────────────────────────────────────
  typingBubble: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  dotsContainer: { flexDirection: 'row', gap: 5, backgroundColor: COLORS.white, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gray },

  // ── Audio Bubble ─────────────────────────────────
  audioBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  playBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  audioWaveform: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveBar: { width: 3, borderRadius: 2 },

  // ── Input Bar ────────────────────────────────────
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.grayLight },
  inputActionBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' },
  textInputWrap: { flex: 1, backgroundColor: COLORS.grayBg, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: COLORS.grayLight },
  textInputRecording: { borderColor: COLORS.error, backgroundColor: '#FEF2F2' },
  inputField: { color: COLORS.dark, fontSize: 15, maxHeight: 100, padding: 0 },
  sendBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  micBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  micBtnActive: { backgroundColor: COLORS.error, shadowColor: COLORS.error, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },

  // ── Camera ───────────────────────────────────────
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  closeCameraBtn: { alignSelf: 'flex-start', margin: 20, width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  cameraFooter: { alignItems: 'center', paddingBottom: 48 },
  captureBtn: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: COLORS.white, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.white },
});
