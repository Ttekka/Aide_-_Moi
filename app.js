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
    loadState();
    initSpeechRecognition();
    updateUI();
});

function loadState() {
    const saved = localStorage.getItem('seniorConnectState');
    if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(appState, parsed);
    }
}

function saveState() {
    localStorage.setItem('seniorConnectState', JSON.stringify(appState));
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
    document.getElementById(screenId).classList.add('active');
    appState.currentScreen = screenId;
}

function switchTab(tab) {
    // Retirer la classe active de tous les boutons
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    switch(tab) {
        case 'chat':
            switchScreen('main-screen');
            document.querySelector('.nav-item').classList.add('active');
            break;
        case 'learning':
            switchScreen('learning-screen');
            document.querySelectorAll('.nav-item')[1].classList.add('active');
            updateLearningScreen();
            break;
        case 'community':
            if (appState.isPremium) {
                switchScreen('community-screen');
                loadCommunity();
            } else {
                switchScreen('community-screen');
            }
            document.querySelectorAll('.nav-item')[2].classList.add('active');
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
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (type === 'assistant') {
        messageDiv.innerHTML = `
            ${text}
            <button class="speaker-btn" onclick="speak('${text.replace(/'/g, "\\'")}')">
                🔊 Écouter
            </button>
        `;
    } else {
        messageDiv.textContent = text;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Apprentissage du vocabulaire
    if (type === 'user') {
        learnFromUserInput(text);
    }
}

function sendMessage() {
    const input = document.getElementById('user-input');
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
    document.getElementById('user-input').value = question;
    sendMessage();
}

// IA Adaptive - Génération de réponses
function generateResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Détection de contexte géographique
    if (lowerMessage.includes('où') && lowerMessage.includes('suis')) {
        return getLocationResponse();
    }
    
    // Email
    if (lowerMessage.includes('email') || lowerMessage.includes('mail')) {
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
    if (lowerMessage.includes('appel') || lowerMessage.includes('vidéo')) {
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
    
    // Réponse adaptative générique
    return adaptResponse(`Je comprends que vous voulez en savoir plus sur "${message}". 

Voici ce que je peux vous expliquer de façon simple :

${getSimplifiedExplanation(message)}

Est-ce que vous voulez plus de détails sur un point particulier ?`);
}

function getSimplifiedExplanation(topic) {
    // Ici, vous pourriez intégrer une vraie IA (OpenAI, etc.)
    const explanations = {
        default: `C'est une fonctionnalité qui vous permet d'accomplir une tâche sur internet. Je vais vous guider pas à pas !`
    };
    
    return explanations.default;
}

function adaptResponse(response) {
    // Adapte le vocabulaire en fonction du niveau de l'utilisateur
    const userLevel = appState.userLevel;
    
    if (userLevel < 3) {
        // Simplifier encore plus
        response = response.replace(/fonctionnalité/g, 'fonction');
        response = response.replace(/navigateur/g, 'programme pour internet');
    }
    
    return response;
}

// Apprentissage du vocabulaire
function learnFromUserInput(text) {
    const words = text.toLowerCase().split(' ');
    
    words.forEach(word => {
        if (word.length > 3) {
            const count = appState.userVocabulary.get(word) || 0;
            appState.userVocabulary.set(word, count + 1);
            
            // Ajouter aux mots appris si répété 3 fois
            if (count + 1 === 3 && !appState.learnedWords.includes(word)) {
                appState.learnedWords.push(word);
                appState.adaptationProgress = Math.min(100, appState.adaptationProgress + 5);
                
                // Level up tous les 10 mots
                if (appState.learnedWords.length % 10 === 0) {
                    appState.userLevel++;
                    showAchievement(`🎉 Niveau ${appState.userLevel} atteint !`);
                }
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
                
                // Utiliser une API de géocodage inverse (exemple avec Nominatim)
                fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
                    .then(response => response.json())
                    .then(data => {
                        const address = data.display_name;
                        const response = `📍 Vous êtes ici : ${address}

Coordonnées : ${latitude.toFixed(4)}, ${longitude.toFixed(4)}

Que voulez-vous faire avec cette information ?`;
                        
                        addMessage('assistant', response);
                        speak("Je vous ai trouvé ! Regardez votre position sur l'écran.");
                    })
                    .catch(error => {
                        addMessage('assistant', "Désolé, je n'ai pas pu déterminer votre adresse exacte, mais je connais vos coordonnées GPS.");
                    });
            },
            (error) => {
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
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            document.getElementById('user-input').value = transcript;
            sendMessage();
        };

        recognition.onerror = (event) => {
            console.error('Erreur de reconnaissance vocale:', event.error);
            stopVoiceRecognition();
        };

        recognition.onend = () => {
            stopVoiceRecognition();
        };
    }
}

function startVoiceRecognition() {
    if (recognition && !isListening) {
        recognition.start();
        isListening = true;
        document.getElementById('voice-btn').classList.add('active');
        document.getElementById('voice-indicator').classList.add('active');
    }
}

function stopVoiceRecognition() {
    if (recognition && isListening) {
        recognition.stop();
        isListening = false;
        document.getElementById('voice-btn').classList.remove('active');
        document.getElementById('voice-indicator').classList.remove('active');
    }
}

// Synthèse vocale
function speak(text) {
    if (synth.speaking) {
        synth.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = appState.settings.speed;
    
    // Sélectionner la voix
    const voices = synth.getVoices();
    const selectedVoice = voices.find(voice => 
        voice.lang.includes('fr') && 
        (appState.settings.voiceType === 'female' ? voice.name.includes('female') || voice.name.includes('Female') : voice.name.includes('male') || voice.name.includes('Male'))
    ) || voices.find(voice => voice.lang.includes('fr'));
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    synth.speak(utterance);
}

// Réglages
function updateFontSize(size) {
    appState.settings.fontSize = parseInt(size);
    document.body.style.fontSize = size + 'px';
    saveState();
}

function adjustFontSize(delta) {
    const slider = document.getElementById('font-slider');
    const newSize = parseInt(slider.value) + delta;
    if (newSize >= 16 && newSize <= 24) {
        slider.value = newSize;
        updateFontSize(newSize);
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
    // Mise à jour de la barre de progression
    document.getElementById('adaptation-progress').style.width = appState.adaptationProgress + '%';
    document.getElementById('adaptation-percent').textContent = appState.adaptationProgress;
    
    // Affichage des mots appris
    const wordList = document.getElementById('word-list');
    wordList.innerHTML = '';
    appState.learnedWords.slice(-20).forEach(word => {
        const chip = document.createElement('div');
        chip.className = 'word-chip';
        chip.textContent = word;
        wordList.appendChild(chip);
    });
    
    // Achievements
    updateAchievements();
}

function updateAchievements() {
    const achievements = [
        { id: 'first-question', name: 'Première question', icon: '🎯', condition: appState.conversationHistory.length >= 1 },
        { id: 'level-5', name: 'Niveau 5', icon: '⭐', condition: appState.userLevel >= 5 },
        { id: 'week-streak', name: '7 jours de suite', icon: '🔥', condition: appState.streak >= 7 },
        { id: 'vocab-master', name: '50 mots appris', icon: '📚', condition: appState.learnedWords.length >= 50 },
        { id: 'early-bird', name: 'Lève-tôt', icon: '🌅', condition: false },
        { id: 'night-owl', name: 'Couche-tard', icon: '🦉', condition: false }
    ];
    
    const achievementsContainer = document.getElementById('achievements');
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

function showAchievement(text) {
    // Créer une notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
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
    document.getElementById('premium-modal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function subscribePremium() {
    // Simulation d'abonnement (intégrer Stripe ou autre)
    if (confirm('Démarrer l\'essai gratuit de 7 jours puis 9.99$/mois ?')) {
        appState.isPremium = true;
        saveState();
        alert('🎉 Bienvenue dans SeniorConnect Premium !');
        closeModal('premium-modal');
        loadCommunity();
    }
}

function loadCommunity() {
    if (appState.isPremium) {
        const communityContent = document.getElementById('community-content');
        communityContent.innerHTML = `
            <div class="community-active">
                <h3>👥 Membres en ligne (12)</h3>
                <div class="member-list">
                    ${generateMemberCards()}
                </div>
                
                <h3 style="margin-top: 2rem;">🎉 Événements à venir</h3>
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
        <div class="member-card" style="background: white; padding: 1rem; border-radius: 12px; margin: 0.5rem 0; box-shadow: var(--shadow);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4>${member.name}</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${member.age} ans • ${member.interests}</p>
                </div>
                <button onclick="startChat('${member.name}')" style="background: var(--secondary-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;">
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
        <div class="event-card" style="background: white; padding: 1rem; border-radius: 12px; margin: 0.5rem 0; box-shadow: var(--shadow);">
            <h4>${event.title}</h4>
            <p style="color: var(--text-secondary);">📅 ${event.date} • ${event.participants} participants</p>
            <button onclick="joinEvent('${event.title}')" style="background: var(--primary-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; margin-top: 0.5rem; cursor: pointer;">
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
    document.getElementById('streak-count').textContent = appState.streak;
    document.getElementById('user-level').textContent = appState.userLevel;
    
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