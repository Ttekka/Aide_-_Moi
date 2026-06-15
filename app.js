// État de l'application
const appState = {
    currentScreen: 'welcome',
    userLevel: 1,
    streak: 0,
    adaptationProgress: 0,
    learnedWords: [],
    isPremium: false,
    settings: {
        fontSize: 18,
        voiceType: 'female',
        speed: 1,
        gpsEnabled: true,
        voiceConfirmEnabled: true
    },
    userVocabulary: new Map(),
    conversationHistory: []
};

// Reconnaissance vocale
let recognition = null;
let synth = window.speechSynthesis;
let isListening = false;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    console.log('Application initialisée');
    loadState();
    initSpeechRecognition();
    updateUI();
    updateAchievements();
});

function loadState() {
    try {
        const saved = localStorage.getItem('seniorConnectState');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(appState, parsed);
            
            // Reconvertir la Map
            if (parsed.userVocabulary) {
                appState.userVocabulary = new Map(Object.entries(parsed.userVocabulary));
            }
        }
    } catch (error) {
        console.error('Erreur chargement état:', error);
    }
}

function saveState() {
    try {
        const toSave = {
            ...appState,
            userVocabulary: Object.fromEntries(appState.userVocabulary)
        };
        localStorage.setItem('seniorConnectState', JSON.stringify(toSave));
    } catch (error) {
        console.error('Erreur sauvegarde état:', error);
    }
}

function startApp() {
    switchScreen('main-screen');
    appState.streak++;
    saveState();
    updateUI();
    
    // Message de bienvenue
    setTimeout(() => {
        addMessage('assistant', `Bonjour ! Je suis là pour vous aider à naviguer sur internet. N'hésitez pas à me poser des questions ! 😊`);
        speak("Bonjour ! Je suis là pour vous aider. Posez-moi vos questions !");
    }, 500);
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        appState.currentScreen = screenId;
    }
}

function switchTab(tab) {
    // Retirer la classe active de tous les boutons
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    switch(tab) {
        case 'chat':
            switchScreen('main-screen');
            document.querySelectorAll('.nav-item')[0].classList.add('active');
            break;
        case 'learning':
            switchScreen('learning-screen');
            document.querySelectorAll('.nav-item')[1].classList.add('active');
            updateLearningScreen();
            break;
        case 'community':
            switchScreen('community-screen');
            document.querySelectorAll('.nav-item')[2].classList.add('active');
            if (appState.isPremium) {
                loadCommunity();
            }
            break;
        case 'settings':
            switchScreen('settings-screen');
            document.querySelectorAll('.nav-item')[3].classList.add('active');
            break;
    }
}

// Gestion des messages
function addMessage(type, text) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (type === 'assistant') {
        const safeText = text.replace(/'/g, "&apos;");
        messageDiv.innerHTML = `
            <div>${text}</div>
            <button class="speaker-btn" onclick="speak(\`${safeText}\`)">
                🔊 Écouter
            </button>
        `;
    } else {
        messageDiv.textContent = text;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Ajouter à l'historique
    appState.conversationHistory.push({ type, text, timestamp: Date.now() });
    
    // Apprentissage du vocabulaire
    if (type === 'user') {
        learnFromUserInput(text);
    }
    
    saveState();
}

function sendMessage() {
    const input = document.getElementById('user-input');
    if (!input) return;
    
    const message = input.value.trim();
    
    if (message) {
        addMessage('user', message);
        input.value = '';
        
        // Simulation de réponse de l'IA
        setTimeout(() => {
            const response = generateResponse(message);
            addMessage('assistant', response);
            if (appState.settings.voiceConfirmEnabled) {
                speak(response);
            }
        }, 1000);
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function askQuestion(question) {
    const input = document.getElementById('user-input');
    if (input) {
        input.value = question;
        sendMessage();
    }
}

// IA Adaptive - Génération de réponses
function generateResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Détection de contexte géographique
    if ((lowerMessage.includes('où') && lowerMessage.includes('suis')) || lowerMessage.includes('position') || lowerMessage.includes('localisation')) {
        return getLocationResponse();
    }
    
    // Email
    if (lowerMessage.includes('email') || lowerMessage.includes('mail') || lowerMessage.includes('courriel')) {
        return `Pour envoyer un email :
        
1️⃣ Ouvrez votre application de messagerie (Gmail, Outlook, etc.)
2️⃣ Cliquez sur le bouton "Nouveau message" ou "Composer"
3️⃣ Dans "À:", tapez l'adresse email du destinataire
4️⃣ Dans "Objet:", écrivez le sujet de votre message
5️⃣ Écrivez votre message dans le grand cadre
6️⃣ Cliquez sur "Envoyer"

Voulez-vous que je vous montre étape par étape ?`;
    }
    
    // Appel vidéo
    if (lowerMessage.includes('appel') || lowerMessage.includes('vidéo') || lowerMessage.includes('visio')) {
        return `Pour faire un appel vidéo :

📱 Sur smartphone :
1️⃣ Ouvrez WhatsApp, Messenger ou FaceTime
2️⃣ Cherchez le contact à appeler
3️⃣ Appuyez sur l'icône de caméra 📹

💻 Sur ordinateur :
1️⃣ Ouvrez Skype, Zoom ou Google Meet
2️⃣ Cliquez sur "Nouvel appel"
3️⃣ Sélectionnez votre contact
4️⃣ Cliquez sur "Appeler avec vidéo"

Quelle application utilisez-vous ?`;
    }
    
    // Google
    if (lowerMessage.includes('google') || lowerMessage.includes('chercher') || lowerMessage.includes('recherche')) {
        return `Pour faire une recherche sur Google :

1️⃣ Ouvrez votre navigateur (Chrome, Safari, etc.)
2️⃣ Allez sur www.google.fr
3️⃣ Tapez votre question dans la barre de recherche
4️⃣ Appuyez sur "Entrée" ou cliquez sur la loupe 🔍
5️⃣ Cliquez sur les résultats qui vous intéressent

Astuce : Posez votre question comme si vous parliez à quelqu'un !`;
    }
    
    // Salutations
    if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut') || lowerMessage.includes('hello')) {
        return `Bonjour ! 😊 Je suis ravi de vous aider aujourd'hui. Comment puis-je vous être utile ?`;
    }
    
    // Merci
    if (lowerMessage.includes('merci') || lowerMessage.includes('thank')) {
        return `Avec plaisir ! 😊 N'hésitez pas si vous avez d'autres questions !`;
    }
    
    // Réponse adaptative générique
    return `Je comprends que vous voulez en savoir plus sur "${message}".

Pouvez-vous me donner plus de détails sur ce que vous cherchez exactement ? Par exemple :
- Voulez-vous apprendre à utiliser quelque chose ?
- Avez-vous un problème technique ?
- Cherchez-vous une information précise ?

Je suis là pour vous aider ! 😊`;
}

function adaptResponse(response) {
    const userLevel = appState.userLevel;
    
    if (userLevel < 3) {
        response = response.replace(/fonctionnalité/g, 'fonction');
        response = response.replace(/navigateur/g, 'programme pour internet');
    }
    
    return response;
}

// Apprentissage du vocabulaire
function learnFromUserInput(text) {
    const words = text.toLowerCase().split(' ').filter(w => w.length > 3);
    
    words.forEach(word => {
        const count = appState.userVocabulary.get(word) || 0;
        appState.userVocabulary.set(word, count + 1);
        
        if (count + 1 === 3 && !appState.learnedWords.includes(word)) {
            appState.learnedWords.push(word);
            appState.adaptationProgress = Math.min(100, appState.adaptationProgress + 5);
            
            if (appState.learnedWords.length % 10 === 0) {
                appState.userLevel++;
                showAchievement(`🎉 Niveau ${appState.userLevel} atteint !`);
            }
        }
    });
    
    saveState();
}

// Géolocalisation
function getLocationResponse() {
    if (!appState.settings.gpsEnabled) {
        return "La géolocalisation est désactivée. Vous pouvez l'activer dans les réglages.";
    }
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                
                fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
                    .then(response => response.json())
                    .then(data => {
                        const address = data.display_name || "Adresse inconnue";
                        const response = `📍 Vous êtes ici : ${address}

Coordonnées : ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                        
                        addMessage('assistant', response);
                        speak("Je vous ai trouvé ! Regardez votre position sur l'écran.");
                    })
                    .catch(error => {
                        console.error('Erreur géocodage:', error);
                        addMessage('assistant', `📍 Vos coordonnées GPS : ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                    });
            },
            (error) => {
                console.error('Erreur géolocalisation:', error);
                addMessage('assistant', "Je n'arrive pas à accéder à votre position. Vérifiez que vous avez autorisé l'accès à votre localisation.");
            }
        );
        
        return "🔍 Je cherche votre position...";
    } else {
        return "Votre appareil ne supporte pas la géolocalisation.";
    }
}

// Reconnaissance vocale
function initSpeechRecognition() {
    try {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.lang = 'fr-FR';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const input = document.getElementById('user-input');
                if (input) {
                    input.value = transcript;
                    sendMessage();
                }
            };

            recognition.onerror = (event) => {
                console.error('Erreur reconnaissance vocale:', event.error);
                stopVoiceRecognition();
            };

            recognition.onend = () => {
                stopVoiceRecognition();
            };
        }
    } catch (error) {
        console.error('Erreur init reconnaissance vocale:', error);
    }
}

function startVoiceRecognition() {
    if (recognition && !isListening) {
        try {
            recognition.start();
            isListening = true;
            const voiceBtn = document.getElementById('voice-btn');
            const voiceIndicator = document.getElementById('voice-indicator');
            if (voiceBtn) voiceBtn.classList.add('active');
            if (voiceIndicator) voiceIndicator.classList.add('active');
        } catch (error) {
            console.error('Erreur démarrage reconnaissance:', error);
        }
    }
}

function stopVoiceRecognition() {
    if (recognition && isListening) {
        try {
            recognition.stop();
            isListening = false;
            const voiceBtn = document.getElementById('voice-btn');
            const voiceIndicator = document.getElementById('voice-indicator');
            if (voiceBtn) voiceBtn.classList.remove('active');
            if (voiceIndicator) voiceIndicator.classList.remove('active');
        } catch (error) {
            console.error('Erreur arrêt reconnaissance:', error);
        }
    }
}

// Synthèse vocale
function speak(text) {
    try {
        if (synth.speaking) {
            synth.cancel();
        }
        
        const cleanText = text.replace(/<[^>]*>/g, '').replace(/[^\w\s.,!?àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/g, '');
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'fr-FR';
        utterance.rate = appState.settings.speed;
        
        const voices = synth.getVoices();
        const frenchVoice = voices.find(voice => voice.lang.startsWith('fr'));
        
        if (frenchVoice) {
            utterance.voice = frenchVoice;
        }
        
        synth.speak(utterance);
    } catch (error) {
        console.error('Erreur synthèse vocale:', error);
    }
}

// Réglages
function updateFontSize(size) {
    appState.settings.fontSize = parseInt(size);
    document.body.style.fontSize = size + 'px';
    saveState();
}

function adjustFontSize(delta) {
    const slider = document.getElementById('font-slider');
    if (slider) {
        const newSize = parseInt(slider.value) + delta;
        if (newSize >= 16 && newSize <= 24) {
            slider.value = newSize;
            updateFontSize(newSize);
        }
    }
}

function changeVoice(type) {
    appState.settings.voiceType = type;
    saveState();
}

function changeSpeed(speed) {
    appState.settings.speed = parseFloat(speed);
    saveState();
}

function toggleGPS(enabled) {
    appState.settings.gpsEnabled = enabled;
    saveState();
}

function toggleVoiceConfirm(enabled) {
    appState.settings.voiceConfirmEnabled = enabled;
    saveState();
}

// Écran d'apprentissage
function updateLearningScreen() {
    const progressBar = document.getElementById('adaptation-progress');
    const progressPercent = document.getElementById('adaptation-percent');
    const wordList = document.getElementById('word-list');
    
    if (progressBar) {
        progressBar.style.width = appState.adaptationProgress + '%';
    }
    
    if (progressPercent) {
        progressPercent.textContent = appState.adaptationProgress;
    }
    
    if (wordList) {
        wordList.innerHTML = '';
        if (appState.learnedWords.length === 0) {
            const emptyChip = document.createElement('div');
            emptyChip.className = 'word-chip';
            emptyChip.textContent = 'Aucun mot appris pour le moment';
            wordList.appendChild(emptyChip);
        } else {
            appState.learnedWords.slice(-20).forEach(word => {
                const chip = document.createElement('div');
                chip.className = 'word-chip';
                chip.textContent = word;
                wordList.appendChild(chip);
            });
        }
    }
    
    updateAchievements();
}

function updateAchievements() {
    const achievements = [
        { id: 'first-question', name: 'Première question', icon: '🎯', condition: appState.conversationHistory.length >= 1 },
        { id: 'level-5', name: 'Niveau 5', icon: '⭐', condition: appState.userLevel >= 5 },
        { id: 'week-streak', name: '7 jours de suite', icon: '🔥', condition: appState.streak >= 7 },
        { id: 'vocab-master', name: '50 mots appris', icon: '📚', condition: appState.learnedWords.length >= 50 },
        { id: 'conversationalist', name: '10 conversations', icon: '💬', condition: appState.conversationHistory.length >= 10 },
        { id: 'explorer', name: 'Explorateur', icon: '🗺️', condition: appState.conversationHistory.some(c => c.text.toLowerCase().includes('où')) }
    ];
    
    const achievementsContainer = document.getElementById('achievements');
    if (achievementsContainer) {
        achievementsContainer.innerHTML = '';
        
        achievements.forEach(achievement => {
            const div = document.createElement('div');
            div.className = `achievement ${achievement.condition ? 'unlocked' : ''}`;
            div.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-name">${achievement.name}</div>
            `;
            achievementsContainer.appendChild(div);
        });
    }
}

function showAchievement(text) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary-color);
        color: white;
        padding: 1rem 2rem;
        border-radius: 12px;
        font-weight: 700;
        font-size: 1.2rem;
        box-shadow: var(--shadow-lg);
        z-index: 3000;
        animation: slideDown 0.5s ease;
        max-width: 90%;
        text-align: center;
    `;
    notification.textContent = text;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Premium
function showPremiumInfo() {
    showPremiumModal();
}

function showPremiumModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function subscribePremium() {
    if (confirm('Démarrer l\'essai gratuit de 7 jours puis 9.99$/mois ?')) {
        appState.isPremium = true;
        saveState();
        alert('🎉 Bienvenue dans SeniorConnect Premium !');
        closeModal('premium-modal');
        loadCommunity();
    }
}

function loadCommunity() {
    const communityContent = document.getElementById('community-content');
    if (!communityContent) return;
    
    if (appState.isPremium) {
        communityContent.innerHTML = `
            <div class="community-active" style="background: white; padding: 1.5rem; border-radius: 16px; box-shadow: var(--shadow);">
                <h3 style="margin-bottom: 1rem;">👥 Membres en ligne (12)</h3>
                <div class="member-list">
                    ${generateMemberCards()}
                </div>
                
                <h3 style="margin: 2rem 0 1rem;">🎉 Événements à venir</h3>
                <div class="events-list">
                    ${generateEvents()}
                </div>
            </div>
        `;
    }
}

function generateMemberCards() {
    const members = [
        { name: 'Marie D.', age: 68, interests: 'Jardinage, Photos' },
        { name: 'Jean P.', age: 72, interests: 'Cuisine, Voyages' },
        { name: 'Claire M.', age: 65, interests: 'Lecture, Musique' },
        { name: 'Robert L.', age: 70, interests: 'Histoire, Nature' }
    ];
    
    return members.map(member => `
        <div class="member-card" style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; margin: 0.5rem 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <div style="flex: 1; min-width: 150px;">
                    <h4 style="margin-bottom: 0.25rem;">${member.name}</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${member.age} ans • ${member.interests}</p>
                </div>
                <button onclick="startChat('${member.name}')" style="background: var(--secondary-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; white-space: nowrap;">
                    💬 Discuter
                </button>
            </div>
        </div>
    `).join('');
}

function generateEvents() {
    const events = [
        { title: 'Atelier Email', date: 'Lundi 15h', participants: 8 },
        { title: 'Café virtuel', date: 'Mercredi 10h', participants: 15 },
        { title: 'Cours Photos', date: 'Vendredi 14h', participants: 6 }
    ];
    
    return events.map(event => `
        <div class="event-card" style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; margin: 0.5rem 0;">
            <h4 style="margin-bottom: 0.5rem;">${event.title}</h4>
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">📅 ${event.date} • ${event.participants} participants</p>
            <button onclick="joinEvent('${event.title}')" style="background: var(--primary-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; width: 100%;">
                Participer
            </button>
        </div>
    `).join('');
}

function startChat(memberName) {
    alert(`Démarrage de la conversation avec ${memberName}...`);
}

function joinEvent(eventTitle) {
    alert(`Vous êtes inscrit à "${eventTitle}" !`);
}

// Mise à jour de l'UI
function updateUI() {
    const streakCount = document.getElementById('streak-count');
    const userLevel = document.getElementById('user-level');
    
    if (streakCount) streakCount.textContent = appState.streak;
    if (userLevel) userLevel.textContent = appState.userLevel;
    
    if (appState.settings.fontSize) {
        document.body.style.fontSize = appState.settings.fontSize + 'px';
        const slider = document.getElementById('font-slider');
        if (slider) slider.value = appState.settings.fontSize;
    }
}

// Charger les voix
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = () => {
        synth.getVoices();
    };
}

// Gestion des clics en dehors du modal
document.addEventListener('click', (e) => {
    const modal = document.getElementById('premium-modal');
    if (modal && e.target === modal) {
        closeModal('premium-modal');
    }
});