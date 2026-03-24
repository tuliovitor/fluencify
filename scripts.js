/* ═══════════════════════════════════════════════════════════════
   FLUENCIFY — Application Logic
   Speech Recognition · N8N Webhook · Text-to-Speech
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  /* ─── DOM REFERENCES ─── */
  const chatArea = document.getElementById('chatArea');
  const micBtn = document.getElementById('micBtn');
  const micWrapper = document.getElementById('micWrapper');
  const micLabel = document.getElementById('micLabel');
  const waveform = document.getElementById('waveform');
  const typingIndicator = document.getElementById('typingIndicator');

  /* ─── CONFIG ─── */
  const N8N_WEBHOOK_URL = 'https://tuliovitor.app.n8n.cloud/webhook/fluencify';
  let isRecording = false;
  let recognition = null;

  /* ─── SVG TEMPLATES ─── */
  const AI_AVATAR_SVG = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z"/>
    </svg>`;

  /* ─── INIT: Welcome Message ─── */
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      addMessage(
        'ai',
        "Hey there! 👋 I'm your AI English tutor. Click the mic and start speaking — I'll help you sound more natural every day."
      );
    }, 600);
  });

  /* ─── CHAT: Add Message ─── */
  function addMessage(type, text, correction) {
    const msgEl = document.createElement('div');
    msgEl.classList.add('message', `message--${type}`);

    if (type === 'ai') {
      msgEl.innerHTML = `
        <div class="message__avatar" aria-hidden="true">
          ${AI_AVATAR_SVG}
        </div>
        <div class="message__content">
          <div class="message__bubble">${escapeHtml(text)}</div>
          ${correction
            ? `<div class="message__correction"><strong>💡 Tip:</strong> ${escapeHtml(correction)}</div>`
            : ''
          }
        </div>
      `;
    } else {
      msgEl.innerHTML = `
        <div class="message__content">
          <div class="message__bubble">${escapeHtml(text)}</div>
        </div>
      `;
    }

    chatArea.appendChild(msgEl);
    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ─── TYPING INDICATOR ─── */
  function showTyping() {
    typingIndicator.classList.add('visible');
    chatArea.appendChild(typingIndicator);
    scrollToBottom();
  }

  function hideTyping() {
    typingIndicator.classList.remove('visible');
  }

  /* ─── SPEECH RECOGNITION ─── */
  function initRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      addMessage(
        'ai',
        "Your browser doesn't support Speech Recognition. Please use Google Chrome for the best experience. 🌐"
      );
      return null;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'pt-BR'; // aceita PT-BR e inglês — o N8N cuida do roteamento
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.addEventListener('result', (e) => {
      const transcript = e.results[0][0].transcript;
      stopRecording();
      addMessage('user', transcript);
      sendToN8N(transcript);
    });

    rec.addEventListener('error', (e) => {
      console.error('Speech Recognition Error:', e.error);
      stopRecording();

      if (e.error === 'no-speech') {
        addMessage(
          'ai',
          "I didn't catch that. Try clicking the mic and speaking clearly. 🎤"
        );
      } else if (e.error === 'not-allowed') {
        addMessage(
          'ai',
          'Microphone access was denied. Please allow mic access in your browser settings. 🔒'
        );
      }
    });

    rec.addEventListener('end', () => {
      if (isRecording) {
        stopRecording();
      }
    });

    return rec;
  }

  /* ─── RECORDING STATES ─── */
  function startRecording() {
    if (!recognition) {
      recognition = initRecognition();
      if (!recognition) return;
    }

    isRecording = true;
    micBtn.classList.add('recording');
    micWrapper.classList.add('recording');
    micLabel.classList.add('recording');
    micLabel.textContent = 'Ouvindo...';
    waveform.classList.add('active');
    micBtn.setAttribute('aria-label', 'Clique para parar de gravar');

    try {
      recognition.start();
    } catch (e) {
      console.warn('Recognition already started');
    }
  }

  function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    micWrapper.classList.remove('recording');
    micLabel.classList.remove('recording');
    micLabel.textContent = 'Clique para falar';
    waveform.classList.remove('active');
    micBtn.setAttribute('aria-label', 'Clique para falar em inglês');

    try {
      recognition.stop();
    } catch (e) {
      // already stopped
    }
  }

  micBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  /* ─── N8N WEBHOOK ─── */
  async function sendToN8N(message) {
    showTyping();

    // Detecção robusta: acentos OU palavras PT-BR comuns (sem acento também)
    const ptBrWords = /\b(você|voce|eu|quero|como|falar|não|nao|isso|para|meu|minha|olá|ola|oi|preciso|pode|obrigado|ajuda|gostaria|estou|tenho|seria|muito|tudo|bem|esse|este|quando|onde|qual|por|com|mas|que|sim|uma)\b/i;
    const lang = /[àáâãéêíóôõúç]/i.test(message) || ptBrWords.test(message) ? 'pt-BR' : 'en-US';

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, lang }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      hideTyping();

      const reply =
        data.reply ||
        data.output ||
        "Sorry, I couldn't process that. Try again! 🔄";
      const correction = data.correction || null;

      addMessage('ai', reply, correction);
      speak(reply);
    } catch (err) {
      console.error('N8N Error:', err);
      hideTyping();

      // Fallback AI responses when webhook isn't configured
      const fallbackResponses = [
        {
          reply: `Great job speaking in English! You said: "${message}". Keep practicing to build your confidence! 💪`,
          correction: null,
        },
        {
          reply: `I heard you say: "${message}". That's a good attempt! Try speaking a bit slower for better pronunciation. 🎯`,
          correction: 'Try to emphasize the stressed syllables more clearly.',
        },
        {
          reply: `Nice try! You said: "${message}". Practice makes perfect — keep going! 🌟`,
          correction: null,
        },
        {
          reply: `Good effort! "${message}" — I can understand you well. Let's keep improving your fluency together! 🚀`,
          correction: null,
        },
      ];

      const fallback =
        fallbackResponses[
          Math.floor(Math.random() * fallbackResponses.length)
        ];
      addMessage('ai', fallback.reply, fallback.correction);
      speak(fallback.reply);
    }
  }

  /* ─── TEXT-TO-SPEECH (BILINGUAL) ─── */

  // Cache de vozes carregadas
  let cachedVoices = [];

  function loadVoices() {
    cachedVoices = window.speechSynthesis.getVoices();
  }

  /**
   * Encontra a melhor voz disponível para o idioma dado.
   * Prioriza vozes femininas quando possível.
   */
  function getVoiceForLang(langPrefix) {
    const femalePattern = /female|zira|samantha|karen|fiona|moira|victoria|francisca|maria|luciana/i;

    // Busca voz feminina primeiro
    const femaleVoice = cachedVoices.find(
      (v) => v.lang.startsWith(langPrefix) && femalePattern.test(v.name)
    );
    if (femaleVoice) return femaleVoice;

    // Fallback: qualquer voz do idioma
    return cachedVoices.find((v) => v.lang.startsWith(langPrefix)) || null;
  }

  /**
   * Detecta se uma frase/segmento é português brasileiro.
   * Usa acentos + palavras comuns PT-BR.
   */
  function isPtBr(segment) {
    if (/[àáâãéêíóôõúç]/i.test(segment)) return true;

    const ptWords = /\b(você|voce|eu|quero|como|falar|não|nao|isso|para|meu|minha|olá|ola|oi|preciso|pode|obrigado|ajuda|gostaria|estou|tenho|seria|muito|tudo|bem|esse|este|quando|onde|qual|por|com|mas|que|sim|uma|seu|sua|mais|agora|vamos|assim|então|entao|aqui|ainda|também|tambem|porque|sempre|nunca|bom|boa|certo|certa|correto|correta|dizer|disse|frase|frase|significa|pronúncia|pronuncia)\b/i;
    return ptWords.test(segment);
  }

  /**
   * Divide o texto em segmentos por idioma (PT-BR ou EN-US).
   * Agrupa frases consecutivas do mesmo idioma para uma leitura mais fluida.
   */
  function splitByLanguage(text) {
    // Remove emojis para análise mais limpa (mas mantém no texto original)
    const cleanForAnalysis = (s) => s.replace(/[\u{1F600}-\u{1FFFF}]/gu, '').trim();

    // Divide por sentenças (ponto, exclamação, interrogação, quebra de linha)
    const sentences = text.split(/(?<=[.!?\n])\s*/);
    const segments = [];
    let currentLang = null;
    let currentText = '';

    for (const sentence of sentences) {
      const clean = cleanForAnalysis(sentence);
      if (!clean) continue;

      const lang = isPtBr(clean) ? 'pt-BR' : 'en-US';

      if (lang === currentLang) {
        // Mesmo idioma → acumula
        currentText += ' ' + sentence;
      } else {
        // Idioma mudou → salva o anterior e começa novo
        if (currentText.trim()) {
          segments.push({ text: currentText.trim(), lang: currentLang });
        }
        currentLang = lang;
        currentText = sentence;
      }
    }

    // Último segmento
    if (currentText.trim()) {
      segments.push({ text: currentText.trim(), lang: currentLang });
    }

    return segments.length > 0
      ? segments
      : [{ text, lang: 'en-US' }]; // fallback
  }

  /**
   * Fala o texto detectando automaticamente os trechos em PT-BR e EN-US,
   * usando a voz correta para cada segmento.
   */
  function speak(text) {
    if (!window.speechSynthesis) return;

    // Cancela qualquer fala em andamento
    window.speechSynthesis.cancel();

    const segments = splitByLanguage(text);

    segments.forEach((segment, index) => {
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = segment.lang;
      utterance.rate = segment.lang === 'pt-BR' ? 0.95 : 0.92;
      utterance.pitch = 1.05;

      const voice = getVoiceForLang(segment.lang === 'pt-BR' ? 'pt' : 'en');
      if (voice) {
        utterance.voice = voice;
      }

      window.speechSynthesis.speak(utterance);
    });
  }

  // Pre-load voices (alguns browsers precisam desse evento)
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }
})();