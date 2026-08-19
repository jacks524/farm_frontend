export const API_BASE_URL = 'https://acia-production.up.railway.app';

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

  const response = await fetch(`${API_BASE_URL}/ask/image`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = 'API Request failed';
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.detail?.[0]?.msg || errorMessage;
    } catch {
      errorMessage = text || response.statusText;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
};

export const askText = async (question, targetLang = 'fr', returnAudio = false, k = 2) => {
  const payload = {
    text_question: question,
    target_lang: targetLang,
    return_audio: returnAudio,
    k: k
  };

  const response = await fetch(`${API_BASE_URL}/ask/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = 'API Request failed';
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.detail?.[0]?.msg || errorMessage;
    } catch {
      errorMessage = text || response.statusText;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
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

  const response = await fetch(`${API_BASE_URL}/ask/audio`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = 'API Request failed';
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.detail?.[0]?.msg || errorMessage;
    } catch {
      errorMessage = text || response.statusText;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
};
