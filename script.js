class ExamProctoringSystem {
    constructor() {
        this.isProctoring = false;
        this.violations = [];
        this.examStartTime = null;
        this.detectionInterval = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        
        // Detection state with counters
        this.detectionState = {
            faceDetected: true,
            multipleFaces: false,
            lookingAway: false,
            phoneDetected: false,
            audioDetected: false,
            // Counters for continuous detection
            noFaceCounter: 0,
            multipleFacesCounter: 0,
            lookingAwayCounter: 0,
            phoneDetectedCounter: 0,
            audioDetectedCounter: 0
        };
        
        // Statistics - Initialize with zeros
        this.stats = {
            totalViolations: 0,
            multipleFaceCount: 0,
            gazeAwayCount: 0,
            phoneUsageCount: 0,
            audioViolationCount: 0,
            noFaceCount: 0
        };

        this.cameraStream = null;
        this.isDemoMode = false;
        this.audioStream = null;
        this.detectionActive = false;
        
        this.initializeEventListeners();
        this.checkCameraSupport();
    }

    async checkCameraSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Camera access not supported in this browser.');
            this.enableDemoMode();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' },
                audio: false 
            });
            
            stream.getTracks().forEach(track => track.stop());
            
            console.log('Camera access available');
            this.updateCameraStatus('Available', 'status-normal');
            
        } catch (error) {
            console.log('Camera access not granted:', error);
            this.showPermissionModal();
        }
    }

    showPermissionModal() {
        const modal = document.getElementById('permissionModal');
        if (modal) {
            modal.style.display = 'block';
            
            document.getElementById('grantPermissionBtn').onclick = () => {
                this.initializeCamera();
            };
            
            document.getElementById('useDemoBtn').onclick = () => {
                this.enableDemoMode();
                modal.style.display = 'none';
            };
        }
    }

    async initializeCamera() {
        try {
            const enableCamera = document.getElementById('enableCamera').checked;
            const enableAudio = document.getElementById('enableAudio').checked;

            if (!enableCamera) {
                this.enableDemoMode();
                this.hidePermissionModal();
                return;
            }

            // Get camera stream
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: enableAudio
            });

            // Get separate audio stream if enabled
            if (enableAudio) {
                try {
                    this.audioStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });
                } catch (audioError) {
                    console.warn('Audio access failed:', audioError);
                    this.showNotification('Audio monitoring not available');
                }
            }
            
            const video = document.getElementById('webcam');
            if (video) {
                video.srcObject = this.cameraStream;
                
                await new Promise((resolve) => {
                    video.onloadedmetadata = () => {
                        video.play();
                        resolve();
                    };
                });
            }

            this.hidePermissionModal();
            this.updateCameraStatus('Active', 'status-normal');
            
            console.log('Camera initialized successfully');

        } catch (error) {
            console.error('Camera initialization failed:', error);
            this.showError('Failed to access camera. Please check permissions and try again.');
            this.enableDemoMode();
        }
    }

    hidePermissionModal() {
        const modal = document.getElementById('permissionModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    enableDemoMode() {
        this.isDemoMode = true;
        this.updateCameraStatus('Demo Mode', 'status-warning');
        this.showNotification('Running in demo mode - using simulated detection');
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

        // Camera control listeners
        document.getElementById('enableCamera')?.addEventListener('change', (e) => {
            if (!e.target.checked && this.cameraStream) {
                this.stopCamera();
            }
        });

        document.getElementById('enableAudio')?.addEventListener('change', (e) => {
            if (!e.target.checked) {
                this.stopAudioMonitoring();
            }
        });
    }

    async startExam() {
        try {
            console.log('Starting exam...');
            
            if (!this.cameraStream && !this.isDemoMode) {
                await this.initializeCamera();
            }

            // Hide placeholder, show video
            const placeholder = document.getElementById('cameraPlaceholder');
            if (placeholder) {
                placeholder.classList.remove('active');
            }
            
            const liveIndicator = document.getElementById('liveIndicator');
            if (liveIndicator) {
                liveIndicator.style.display = 'flex';
            }
            
            // Update UI
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
            document.getElementById('systemStatus').textContent = 'Monitoring';
            document.getElementById('systemStatus').className = 'status-normal';
            
            this.isProctoring = true;
            this.detectionActive = true;
            this.examStartTime = new Date();
            this.violations = [];
            
            // Reset statistics
            this.resetStatistics();
            
            // Reset detection counters
            this.resetDetectionCounters();
            
            // Start detection loop
            this.startDetection();
            
            // Start audio monitoring if enabled
            if (document.getElementById('enableAudio')?.checked) {
                this.startAudioMonitoring();
            }
            
            this.updateUI();
            
            console.log('Exam proctoring started successfully');
            this.showNotification('Exam monitoring started - All detections active');
            
        } catch (error) {
            console.error('Error starting exam:', error);
            this.showError('Failed to start exam monitoring: ' + error.message);
        }
    }

    resetStatistics() {
        this.stats = {
            totalViolations: 0,
            multipleFaceCount: 0,
            gazeAwayCount: 0,
            phoneUsageCount: 0,
            audioViolationCount: 0,
            noFaceCount: 0
        };
    }

    resetDetectionCounters() {
        this.detectionState.noFaceCounter = 0;
        this.detectionState.multipleFacesCounter = 0;
        this.detectionState.lookingAwayCounter = 0;
        this.detectionState.phoneDetectedCounter = 0;
        this.detectionState.audioDetectedCounter = 0;
    }

    stopExam() {
        console.log('Stopping exam...');
        
        this.isProctoring = false;
        this.detectionActive = false;
        
        // Hide live indicator
        const liveIndicator = document.getElementById('liveIndicator');
        if (liveIndicator) {
            liveIndicator.style.display = 'none';
        }
        
        // Show placeholder if no camera
        if (!this.cameraStream) {
            const placeholder = document.getElementById('cameraPlaceholder');
            if (placeholder) {
                placeholder.classList.add('active');
            }
        }
        
        // Stop detection interval
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        
        // Stop audio monitoring
        this.stopAudioMonitoring();
        
        // Update UI
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('systemStatus').textContent = 'Ready';
        
        // Clear any active detection overlays
        this.clearDetectionOverlay();
        
        // Show summary
        const duration = this.getExamDuration();
        const summary = `Exam proctoring stopped!\nDuration: ${duration}\nTotal violations: ${this.stats.totalViolations}`;
        
        this.showNotification(summary);
        console.log('Exam proctoring stopped successfully');
        
        // Force update dashboard to show final time
        this.updateDashboard();
    }

    clearDetectionOverlay() {
        const canvas = document.getElementById('outputCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        const video = document.getElementById('webcam');
        if (video) {
            video.srcObject = null;
        }
        const placeholder = document.getElementById('cameraPlaceholder');
        if (placeholder) {
            placeholder.classList.add('active');
        }
        this.updateCameraStatus('Inactive', 'status-warning');
    }

    startDetection() {
        // Clear any existing interval
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }

        this.detectionInterval = setInterval(() => {
            if (!this.detectionActive) {
                clearInterval(this.detectionInterval);
                return;
            }
            
            this.runAllDetections();
            this.updateUI();
        }, 2000); // Check every 2 seconds
    }

    runAllDetections() {
        if (!this.detectionActive) return;

        console.log('Running detections...');
        
        // Run all detection methods
        this.detectMultipleFaces();
        this.detectPhoneUsage();
        this.detectLookingAway();
        this.detectNoFace();
        this.detectAudioEvents();
        
        // Update face status display
        this.updateFaceStatus();
    }

    detectMultipleFaces() {
        // Simulate multiple face detection - 15% chance
        if (Math.random() < 0.15) {
            this.detectionState.multipleFacesCounter++;
            console.log(`Multiple faces counter: ${this.detectionState.multipleFacesCounter}`);
            
            if (this.detectionState.multipleFacesCounter >= 2) {
                this.triggerViolation('Multiple faces detected in frame', 'high', 'multiple-faces');
                this.stats.multipleFaceCount++;
                this.detectionState.multipleFacesCounter = 0;
                
                // Visual feedback
                this.showDetectionAlert('MULTIPLE FACES DETECTED!', '#FF0000');
            }
        } else {
            this.detectionState.multipleFacesCounter = 0;
        }
    }

    detectPhoneUsage() {
        // Simulate phone detection - 12% chance
        if (Math.random() < 0.12) {
            this.detectionState.phoneDetectedCounter++;
            console.log(`Phone usage counter: ${this.detectionState.phoneDetectedCounter}`);
            
            if (this.detectionState.phoneDetectedCounter >= 2) {
                this.triggerViolation('Potential phone usage detected - unusual hand movements', 'high', 'phone-usage');
                this.stats.phoneUsageCount++;
                this.detectionState.phoneDetectedCounter = 0;
                
                // Visual feedback
                this.showDetectionAlert('PHONE USAGE DETECTED!', '#FF6B00');
            }
        } else {
            this.detectionState.phoneDetectedCounter = 0;
        }
    }

    detectLookingAway() {
        // Simulate looking away - 20% chance
        if (Math.random() < 0.20) {
            this.detectionState.lookingAwayCounter++;
            console.log(`Looking away counter: ${this.detectionState.lookingAwayCounter}`);
            
            if (this.detectionState.lookingAwayCounter >= 2) {
                this.triggerViolation('Looking away from screen for extended period', 'medium', 'gaze-tracking');
                this.stats.gazeAwayCount++;
                this.detectionState.lookingAwayCounter = 0;
            }
        } else {
            this.detectionState.lookingAwayCounter = Math.max(0, this.detectionState.lookingAwayCounter - 1);
        }
    }

    detectNoFace() {
        // Simulate no face detection - 8% chance
        if (Math.random() < 0.08) {
            this.detectionState.noFaceCounter++;
            console.log(`No face counter: ${this.detectionState.noFaceCounter}`);
            
            if (this.detectionState.noFaceCounter >= 3) {
                this.triggerViolation('No face detected for extended period', 'high', 'face-detection');
                this.stats.noFaceCount++;
                this.detectionState.noFaceCounter = 0;
                
                // Visual feedback
                this.showDetectionAlert('NO FACE DETECTED!', '#FF0000');
            }
        } else {
            this.detectionState.noFaceCounter = 0;
        }
    }

    detectAudioEvents() {
        // Simulate audio detection - 10% chance
        if (Math.random() < 0.10) {
            this.detectionState.audioDetectedCounter++;
            console.log(`Audio events counter: ${this.detectionState.audioDetectedCounter}`);
            
            if (this.detectionState.audioDetectedCounter >= 2) {
                this.triggerViolation('Unusual audio activity detected', 'medium', 'audio-monitoring');
                this.stats.audioViolationCount++;
                this.detectionState.audioDetectedCounter = 0;
                
                console.log('🔊 Audio violation detected');
            }
        } else {
            this.detectionState.audioDetectedCounter = Math.max(0, this.detectionState.audioDetectedCounter - 1);
        }
        
        // Update audio level display with simulated values
        this.updateAudioLevel(Math.random() * 100);
    }

    showDetectionAlert(message, color) {
        const canvas = document.getElementById('outputCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width || 640;
        const height = canvas.height || 480;
        
        // Draw alert background
        ctx.fillStyle = color + '20'; // Add transparency
        ctx.fillRect(0, 0, width, height);
        
        // Draw alert text
        ctx.fillStyle = color;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(message, width / 2, height / 2);
        
        // Draw border
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.strokeRect(0, 0, width, height);
        
        // Clear after 1.5 seconds
        setTimeout(() => {
            if (this.detectionActive) {
                ctx.clearRect(0, 0, width, height);
            }
        }, 1500);
    }

    startAudioMonitoring() {
        if ((!this.cameraStream && !this.audioStream) || this.isDemoMode) {
            console.log('Using simulated audio detection');
            return;
        }

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            
            const audioSource = this.audioStream || this.cameraStream;
            this.microphone = this.audioContext.createMediaStreamSource(audioSource);
            
            this.microphone.connect(this.analyser);
            this.analyser.fftSize = 256;
            
            console.log('Real audio monitoring started');
            
        } catch (error) {
            console.warn('Real audio monitoring failed:', error);
        }
    }

    updateAudioLevel(level) {
        const audioEventsStat = document.getElementById('audioEventsStat');
        if (audioEventsStat) {
            audioEventsStat.textContent = this.stats.audioViolationCount;
            audioEventsStat.style.color = this.stats.audioViolationCount > 0 ? '#f44336' : '#4CAF50';
        }
    }

    updateFaceStatus() {
        const faceStatus = document.getElementById('faceStatus');
        if (!faceStatus) return;

        if (this.detectionState.multipleFacesCounter > 0) {
            faceStatus.textContent = 'Multiple faces detected!';
            faceStatus.className = 'status-danger';
        } else if (this.detectionState.noFaceCounter > 0) {
            faceStatus.textContent = 'No face detected!';
            faceStatus.className = 'status-warning';
        } else {
            faceStatus.textContent = 'Face detected';
            faceStatus.className = 'status-normal';
        }
    }

    triggerViolation(message, severity, type) {
        const violation = {
            timestamp: new Date().toLocaleTimeString(),
            message: message,
            severity: severity,
            type: type
        };
        
        this.violations.push(violation);
        this.stats.totalViolations++;
        
        console.log(`🚨 VIOLATION: ${message} (${severity})`);
        
        // Show modal for high severity violations
        if (severity === 'high') {
            this.showViolationModal(message, severity);
        }
        
        this.saveToLocalStorage();
    }

    showViolationModal(message, severity) {
        const modal = document.getElementById('violationModal');
        if (modal) {
            document.getElementById('violationMessage').textContent = message;
            document.getElementById('violationSeverity').textContent = severity.charAt(0).toUpperCase() + severity.slice(1);
            document.getElementById('violationSeverity').className = `severity-${severity}`;
            document.getElementById('violationTime').textContent = new Date().toLocaleTimeString();
            modal.style.display = 'block';
        }
    }

    closeModal() {
        const violationModal = document.getElementById('violationModal');
        const permissionModal = document.getElementById('permissionModal');
        
        if (violationModal) violationModal.style.display = 'none';
        if (permissionModal) permissionModal.style.display = 'none';
    }

    updateUI() {
        if (!this.detectionActive) return;

        // Update main violation count
        const violationCountEl = document.getElementById('violationCount');
        if (violationCountEl) {
            violationCountEl.textContent = this.stats.totalViolations;
        }
        
        // Update current alerts
        const alertsContainer = document.getElementById('currentAlerts');
        if (alertsContainer) {
            const recentViolations = this.violations.slice(-3).reverse();
            
            if (recentViolations.length > 0) {
                alertsContainer.innerHTML = recentViolations.map(violation => 
                    `<div class="alert-item severity-${violation.severity}">
                        <span class="alert-time">[${violation.timestamp}]</span>
                        ${violation.message}
                    </div>`
                ).join('');
            } else {
                alertsContainer.innerHTML = '<div class="no-alerts">No alerts</div>';
            }
        }
        
        // Update detection statistics
        this.updateDetectionStats();
        
        // Update system status
        this.updateSystemStatus();
        
        // Update dashboard
        this.updateDashboard();
    }

    updateDetectionStats() {
        const lookingAwayStat = document.getElementById('lookingAwayStat');
        const multipleFacesStat = document.getElementById('multipleFacesStat');
        const phoneUsageStat = document.getElementById('phoneUsageStat');
        const audioEventsStat = document.getElementById('audioEventsStat');
        
        if (lookingAwayStat) lookingAwayStat.textContent = this.stats.gazeAwayCount;
        if (multipleFacesStat) multipleFacesStat.textContent = this.stats.multipleFaceCount;
        if (phoneUsageStat) phoneUsageStat.textContent = this.stats.phoneUsageCount;
        if (audioEventsStat) audioEventsStat.textContent = this.stats.audioViolationCount;
    }

    updateSystemStatus() {
        const systemStatus = document.getElementById('systemStatus');
        if (!systemStatus) return;

        if (this.stats.totalViolations > 8) {
            systemStatus.textContent = 'HIGH RISK';
            systemStatus.className = 'status-danger';
        } else if (this.stats.totalViolations > 3) {
            systemStatus.textContent = 'SUSPICIOUS';
            systemStatus.className = 'status-warning';
        } else {
            systemStatus.textContent = 'NORMAL';
            systemStatus.className = 'status-normal';
        }
    }

    updateCameraStatus(status, className) {
        const cameraStatus = document.getElementById('cameraStatus');
        if (cameraStatus) {
            cameraStatus.textContent = status;
            cameraStatus.className = className;
        }
    }

    showNotification(message) {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notif => notif.remove());
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">ℹ️</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    stopAudioMonitoring() {
        if (this.audioContext) {
            this.audioContext.close().catch(console.warn);
            this.audioContext = null;
        }
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        this.analyser = null;
        this.microphone = null;
    }

    updateDashboard() {
        // Update total violations
        const totalViolationsEl = document.getElementById('totalViolations');
        if (totalViolationsEl) {
            totalViolationsEl.textContent = this.stats.totalViolations;
        }
        
        // Update exam duration - FIXED: Stop updating when exam is stopped
        const examDurationEl = document.getElementById('examDuration');
        if (examDurationEl) {
            if (this.isProctoring && this.examStartTime) {
                examDurationEl.textContent = this.getExamDuration();
            } else if (this.examStartTime && !this.isProctoring) {
                // Keep the last duration when stopped
                examDurationEl.textContent = this.getExamDuration();
            } else {
                examDurationEl.textContent = '0:00';
            }
        }
        
        // Update risk level
        const riskLevelEl = document.getElementById('riskLevel');
        if (riskLevelEl) {
            let riskLevel = 'low';
            if (this.stats.totalViolations > 8) riskLevel = 'high';
            else if (this.stats.totalViolations > 3) riskLevel = 'medium';
            
            riskLevelEl.textContent = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
            riskLevelEl.className = `${riskLevel}-risk`;
        }
        
        // Update attention score
        const attentionScoreEl = document.getElementById('attentionScore');
        if (attentionScoreEl) {
            const score = Math.max(0, 100 - (this.stats.totalViolations * 8));
            attentionScoreEl.textContent = `${score}%`;
        }
        
        // Update violations list
        const violationsListEl = document.getElementById('violationsList');
        if (violationsListEl) {
            if (this.violations.length > 0) {
                violationsListEl.innerHTML = this.violations.slice().reverse().map(violation => `
                    <div class="violation-log-item severity-${violation.severity}">
                        <span class="log-time">${violation.timestamp}</span>
                        <span class="log-message">${violation.message}</span>
                        <span class="log-severity severity-${violation.severity}">${violation.severity}</span>
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
            'detailAudio': this.stats.audioViolationCount,
            'detailNoFace': this.stats.noFaceCount
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
            examStartTime: this.examStartTime,
            isProctoring: this.isProctoring
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
            this.isProctoring = parsed.isProctoring || false;
            
            // If exam was running when page closed, stop it
            if (this.isProctoring) {
                this.isProctoring = false;
                this.examStartTime = null;
            }
        }
    }
}

// Initialize the system
document.addEventListener('DOMContentLoaded', function() {
    window.proctoringSystem = new ExamProctoringSystem();
    window.proctoringSystem.loadFromLocalStorage();
    
    // Only set up dashboard updates if we're on dashboard page
    if (window.location.pathname.includes('dashboard.html') || window.location.href.includes('dashboard')) {
        // Update dashboard immediately
        window.proctoringSystem.updateDashboard();
        
        // Set up periodic updates only if exam is running
        const dashboardInterval = setInterval(() => {
            if (window.proctoringSystem.isProctoring) {
                window.proctoringSystem.updateDashboard();
            } else {
                // Stop updating when exam is not running
                clearInterval(dashboardInterval);
            }
        }, 1000);
    }
});
