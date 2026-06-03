const API_BASE_URL = 'https://acia-production.up.railway.app';

export const askImage = async (imageUri, targetLang = 'fr', returnAudio = true, k = 2) => {
  const formData = new FormData();
  const uriParts = imageUri.split('.');
  const fileType = uriParts[uriParts.length - 1];
  
  formData.append('image', {
    uri: imageUri,
    name: `photo.${fileType}`,
    type: `image/${fileType}`,
  });
  
  formData.append('target_lang', targetLang);
  formData.append('return_audio', returnAudio.toString());
  formData.append('k', k.toString());

  console.log('=========================================');
  console.log(`🚀 API CALL (Image):`);
  console.log(`curl -X POST "${API_BASE_URL}/ask/image" \\`);
  console.log(`  -H "Content-Type: multipart/form-data" \\`);
  console.log(`  -F "image=@photo.${fileType}" \\`);
  console.log(`  -F "target_lang=${targetLang}" \\`);
  console.log(`  -F "return_audio=${returnAudio}" \\`);
  console.log(`  -F "k=${k}"`);
  console.log('=========================================');

  try {
    const response = await fetch(`${API_BASE_URL}/ask/image`, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const responseClone = response.clone();

    if (!response.ok) {
      let errorMessage = 'API Request failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail?.[0]?.msg || errorMessage;
      } catch (e) {
        const textError = await responseClone.text();
        errorMessage = textError || response.statusText;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export const askText = async (question, targetLang = 'fr', returnAudio = false, k = 2) => {
  const payload = {
    text_question: question,
    target_lang: targetLang,
    return_audio: returnAudio,
    k: k
  };

  console.log('=========================================');
  console.log(`🚀 API CALL (Text):`);
  console.log(`curl -X POST "${API_BASE_URL}/ask/text" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '${JSON.stringify(payload)}'`);
  console.log('=========================================');

  try {
    const response = await fetch(`${API_BASE_URL}/ask/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseClone = response.clone();

    if (!response.ok) {
      let errorMessage = 'API Request failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail?.[0]?.msg || errorMessage;
      } catch (e) {
        const textError = await responseClone.text();
        errorMessage = textError || response.statusText;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export const askAudio = async (audioUri, targetLang = 'ha', returnAudio = true, k = 2) => {
  const formData = new FormData();
  const uriParts = audioUri.split('.');
  const fileType = uriParts[uriParts.length - 1];
  
  formData.append('audio', {
    uri: audioUri,
    name: `audio.${fileType}`,
    type: `audio/${fileType}`,
  });
  
  formData.append('target_lang', targetLang);
  formData.append('return_audio', returnAudio.toString());
  formData.append('k', k.toString());

  console.log('=========================================');
  console.log(`🚀 API CALL (Audio):`);
  console.log(`curl -X POST "${API_BASE_URL}/ask/audio" \\`);
  console.log(`  -H "Content-Type: multipart/form-data" \\`);
  console.log(`  -F "audio=@audio.${fileType}" \\`);
  console.log(`  -F "target_lang=${targetLang}" \\`);
  console.log(`  -F "return_audio=${returnAudio}" \\`);
  console.log(`  -F "k=${k}"`);
  console.log('=========================================');

  try {
    const response = await fetch(`${API_BASE_URL}/ask/audio`, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const responseClone = response.clone();

    if (!response.ok) {
      let errorMessage = 'API Request failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail?.[0]?.msg || errorMessage;
      } catch (e) {
        const textError = await responseClone.text();
        errorMessage = textError || response.statusText;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
