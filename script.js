class ExamProctoringSystem {
    constructor() {
        this.isProctoring = false;
        this.violations = [];
        this.examStartTime = null;
        this.detectionInterval = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        
        // Detection state
        this.detectionState = {
            faceDetected: false,
            multipleFaces: false,
            lookingAway: false,
            phoneDetected: false,
            eyesClosed: false,
            audioDetected: false
        };
        
        // Statistics
        this.stats = {
            totalViolations: 0,
            multipleFaceCount: 0,
            gazeAwayCount: 0,
            phoneUsageCount: 0,
            eyeClosureCount: 0,
            audioViolationCount: 0
        };
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Start/Stop exam buttons
        document.getElementById('startBtn')?.addEventListener('click', () => this.startExam());
        document.getElementById('stopBtn')?.addEventListener('click', () => this.stopExam());
        document.getElementById('dashboardBtn')?.addEventListener('click', () => this.viewDashboard());
        
        // Modal controls
        document.querySelector('.close-modal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('acknowledgeBtn')?.addEventListener('click', () => this.closeModal());
        
        // Close modal when clicking outside
        document.getElementById('violationModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'violationModal') this.closeModal();
        });
    }

    async startExam() {
        try {
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 },
                audio: true 
            });
            
            // Setup video element
            const video = document.getElementById('webcam');
            video.srcObject = stream;
            
            // Hide placeholder
            document.getElementById('cameraPlaceholder').style.display = 'none';
            
            // Update UI
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
            document.getElementById('systemStatus').textContent = 'Monitoring';
            document.getElementById('systemStatus').className = 'status-normal';
            
            this.isProctoring = true;
            this.examStartTime = new Date();
            this.violations = [];
            
            // Start detection loop
            this.startDetection();
            
            // Start audio monitoring
            this.startAudioMonitoring(stream);
            
            // Update dashboard if on dashboard page
            this.updateDashboard();
            
            console.log('Exam proctoring started');
            
        } catch (error) {
            console.error('Error starting exam:', error);
            alert('Could not access camera. Please ensure you have granted camera permissions.');
        }
    }

    stopExam() {
        this.isProctoring = false;
        
        // Stop video stream
        const video = document.getElementById('webcam');
        const stream = video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        video.srcObject = null;
        
        // Show placeholder
        document.getElementById('cameraPlaceholder').style.display = 'flex';
        
        // Stop detection
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }
        
        // Stop audio monitoring
        this.stopAudioMonitoring();
        
        // Update UI
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('systemStatus').textContent = 'Ready';
        
        // Show summary
        const duration = this.getExamDuration();
        alert(`Exam proctoring stopped!\nDuration: ${duration}\nTotal violations: ${this.stats.totalViolations}`);
        
        console.log('Exam proctoring stopped');
    }

    startDetection() {
        this.detectionInterval = setInterval(() => {
            this.simulateDetection();
            this.updateUI();
        }, 2000); // Check every 2 seconds
    }

    simulateDetection() {
        if (!this.isProctoring) return;

        const random = Math.random();
        
        // Simulate different types of violations
        if (random < 0.05) { // 5% chance of multiple faces
            this.triggerViolation('Multiple faces detected', 'medium');
            this.stats.multipleFaceCount++;
            this.detectionState.multipleFaces = true;
        } else {
            this.detectionState.multipleFaces = false;
        }
        
        if (random < 0.08) { // 8% chance of looking away
            this.triggerViolation('Looking away from screen', 'low');
            this.stats.gazeAwayCount++;
            this.detectionState.lookingAway = true;
        } else {
            this.detectionState.lookingAway = false;
        }
        
        if (random < 0.03) { // 3% chance of phone usage
            this.triggerViolation('Potential phone usage detected', 'high');
            this.stats.phoneUsageCount++;
            this.detectionState.phoneDetected = true;
        } else {
            this.detectionState.phoneDetected = false;
        }
        
        if (random < 0.04) { // 4% chance of eye closure
            this.triggerViolation('Prolonged eye closure', 'medium');
            this.stats.eyeClosureCount++;
            this.detectionState.eyesClosed = true;
        } else {
            this.detectionState.eyesClosed = false;
        }
        
        // Always detect face (simulated)
        this.detectionState.faceDetected = true;
    }

    triggerViolation(message, severity) {
        const violation = {
            timestamp: new Date().toLocaleTimeString(),
            message: message,
            severity: severity
        };
        
        this.violations.push(violation);
        this.stats.totalViolations++;
        
        // Show violation modal for high severity
        if (severity === 'high') {
            this.showViolationModal(message, severity);
        }
        
        // Update localStorage for dashboard
        this.saveToLocalStorage();
    }

    showViolationModal(message, severity) {
        document.getElementById('violationMessage').textContent = message;
        document.getElementById('violationSeverity').textContent = severity.charAt(0).toUpperCase() + severity.slice(1);
        document.getElementById('violationSeverity').className = `severity-${severity}`;
        document.getElementById('violationModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('violationModal').style.display = 'none';
    }

    async startAudioMonitoring(stream) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.microphone.connect(this.analyser);
            this.analyser.fftSize = 256;
            
            this.monitorAudioLevel();
        } catch (error) {
            console.warn('Audio monitoring not available:', error);
        }
    }

    monitorAudioLevel() {
        if (!this.analyser) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        const checkAudio = () => {
            if (!this.isProctoring) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            // Trigger violation if audio level is too high
            if (average > 60) { // Threshold for loud noise
                this.triggerViolation('Unusual audio activity detected', 'medium');
                this.stats.audioViolationCount++;
                this.detectionState.audioDetected = true;
            } else {
                this.detectionState.audioDetected = false;
            }
            
            setTimeout(checkAudio, 1000);
        };
        
        checkAudio();
    }

    stopAudioMonitoring() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    updateUI() {
        // Update violation count
        document.getElementById('violationCount').textContent = this.stats.totalViolations;
        
        // Update face status
        const faceStatus = document.getElementById('faceStatus');
        if (this.detectionState.faceDetected) {
            faceStatus.textContent = 'Face detected';
            faceStatus.className = 'status-normal';
        } else {
            faceStatus.textContent = 'No face';
            faceStatus.className = 'status-warning';
        }
        
        // Update alerts
        const alertsContainer = document.getElementById('currentAlerts');
        const recentViolations = this.violations.slice(-3).reverse();
        
        if (recentViolations.length > 0) {
            alertsContainer.innerHTML = recentViolations.map(violation => 
                `<div class="alert-item">
                    [${violation.timestamp}] ${violation.message}
                </div>`
            ).join('');
        } else {
            alertsContainer.innerHTML = '<div class="no-alerts">No alerts</div>';
        }
        
        // Update detection statistics
        document.getElementById('lookingAwayStat').textContent = 
            `${Math.round((this.stats.gazeAwayCount / this.stats.totalViolations) * 100) || 0}%`;
        document.getElementById('multipleFacesStat').textContent = this.stats.multipleFaceCount;
        document.getElementById('eyeClosureStat').textContent = 
            `${Math.round((this.stats.eyeClosureCount / this.stats.totalViolations) * 100) || 0}%`;
        
        // Update system status if there are violations
        if (this.stats.totalViolations > 0) {
            document.getElementById('systemStatus').textContent = 'SUSPICIOUS ACTIVITY';
            document.getElementById('systemStatus').className = 'status-danger';
        }
        
        // Update dashboard
        this.updateDashboard();
    }

    updateDashboard() {
        // Update total violations
        const totalViolationsEl = document.getElementById('totalViolations');
        if (totalViolationsEl) {
            totalViolationsEl.textContent = this.stats.totalViolations;
        }
        
        // Update exam duration
        const examDurationEl = document.getElementById('examDuration');
        if (examDurationEl && this.examStartTime) {
            examDurationEl.textContent = this.getExamDuration();
        }
        
        // Update risk level
        const riskLevelEl = document.getElementById('riskLevel');
        if (riskLevelEl) {
            let riskLevel = 'low';
            if (this.stats.totalViolations > 5) riskLevel = 'high';
            else if (this.stats.totalViolations > 2) riskLevel = 'medium';
            
            riskLevelEl.textContent = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
            riskLevelEl.className = `${riskLevel}-risk`;
        }
        
        // Update attention score
        const attentionScoreEl = document.getElementById('attentionScore');
        if (attentionScoreEl) {
            const score = Math.max(0, 100 - (this.stats.totalViolations * 10));
            attentionScoreEl.textContent = `${score}%`;
        }
        
        // Update violations list
        const violationsListEl = document.getElementById('violationsList');
        if (violationsListEl) {
            if (this.violations.length > 0) {
                violationsListEl.innerHTML = this.violations.slice().reverse().map(violation => `
                    <div class="violation-log-item">
                        <span>${violation.timestamp}</span>
                        <span>${violation.message}</span>
                        <span class="severity-${violation.severity}">${violation.severity}</span>
                    </div>
                `).join('');
            } else {
                violationsListEl.innerHTML = `
                    <div class="no-violations">
                        <div class="no-data-icon">📝</div>
                        <p>No violations recorded</p>
                        <small>Violations will appear here when detected</small>
                    </div>
                `;
            }
        }
        
        // Update detailed statistics
        this.updateDetailedStats();
    }

    updateDetailedStats() {
        const details = {
            'detailMultipleFaces': this.stats.multipleFaceCount,
            'detailGazeAway': this.stats.gazeAwayCount,
            'detailPhoneUsage': this.stats.phoneUsageCount,
            'detailEyeClosure': this.stats.eyeClosureCount,
            'detailAudio': this.stats.audioViolationCount
        };
        
        Object.entries(details).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    getExamDuration() {
        if (!this.examStartTime) return '0:00';
        
        const now = new Date();
        const diff = Math.floor((now - this.examStartTime) / 1000);
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    viewDashboard() {
        window.location.href = 'dashboard.html';
    }

    saveToLocalStorage() {
        const data = {
            violations: this.violations,
            stats: this.stats,
            examStartTime: this.examStartTime
        };
        localStorage.setItem('examProctoringData', JSON.stringify(data));
    }

    loadFromLocalStorage() {
        const data = localStorage.getItem('examProctoringData');
        if (data) {
            const parsed = JSON.parse(data);
            this.violations = parsed.violations || [];
            this.stats = parsed.stats || this.stats;
            this.examStartTime = parsed.examStartTime ? new Date(parsed.examStartTime) : null;
        }
    }
}

// Initialize the system when the page loads
document.addEventListener('DOMContentLoaded', function() {
    window.proctoringSystem = new ExamProctoringSystem();
    window.proctoringSystem.loadFromLocalStorage();
    
    // Update dashboard immediately if on dashboard page
    if (window.location.pathname.includes('dashboard.html')) {
        window.proctoringSystem.updateDashboard();
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.hidden && window.proctoringSystem.isProctoring) {
        window.proctoringSystem.triggerViolation('Browser tab not active', 'high');
    }
});

// Handle window focus/blur
window.addEventListener('blur', function() {
    if (window.proctoringSystem.isProctoring) {
        window.proctoringSystem.triggerViolation('Window not focused', 'medium');
    }
});
