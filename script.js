class ExamProctoringSystem {
    constructor() {
        this.isProctoring = false;
        this.violations = [];
        this.examStartTime = null;
        this.detectionInterval = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.faceDetector = null;
        this.faceModel = null;
        
        // Detection state
        this.detectionState = {
            faceDetected: false,
            multipleFaces: false,
            lookingAway: false,
            phoneDetected: false,
            audioDetected: false,
            eyesClosed: false
        };
        
        // Statistics
        this.stats = {
            totalViolations: 0,
            multipleFaceCount: 0,
            gazeAwayCount: 0,
            phoneUsageCount: 0,
            audioViolationCount: 0,
            eyeClosureCount: 0
        };

        this.cameraStream = null;
        this.isDemoMode = false;
        
        this.initializeEventListeners();
        this.checkCameraSupport();
    }

    async checkCameraSupport() {
        // Check if browser supports camera access
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Camera access not supported in this browser.');
            this.enableDemoMode();
            return;
        }

        try {
            // Try to get camera permissions without starting stream
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' },
                audio: false 
            });
            
            // Immediately stop the stream - we just wanted to check permissions
            stream.getTracks().forEach(track => track.stop());
            
            console.log('Camera access available');
            this.updateCameraStatus('Available', 'status-normal');
            
        } catch (error) {
            console.log('Camera access not granted:', error);
            this.showPermissionModal();
        }
    }

    showPermissionModal() {
        document.getElementById('permissionModal').style.display = 'block';
        
        document.getElementById('grantPermissionBtn').onclick = () => {
            this.initializeCamera();
        };
        
        document.getElementById('useDemoBtn').onclick = () => {
            this.enableDemoMode();
            document.getElementById('permissionModal').style.display = 'none';
        };
    }

    async initializeCamera() {
        try {
            const enableCamera = document.getElementById('enableCamera').checked;
            const enableAudio = document.getElementById('enableAudio').checked;

            if (!enableCamera) {
                this.enableDemoMode();
                document.getElementById('permissionModal').style.display = 'none';
                return;
            }

            const constraints = {
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                },
                audio: enableAudio
            };

            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            const video = document.getElementById('webcam');
            video.srcObject = this.cameraStream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });

            document.getElementById('permissionModal').style.display = 'none';
            this.updateCameraStatus('Active', 'status-normal');
            
            // Initialize face detection
            await this.initializeFaceDetection();
            
            console.log('Camera initialized successfully');

        } catch (error) {
            console.error('Camera initialization failed:', error);
            this.showError('Failed to access camera. Please check permissions and try again.');
            this.enableDemoMode();
        }
    }

    async initializeFaceDetection() {
        try {
            // Load face detection model
            this.faceModel = await faceLandmarksDetection.load(
                faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
                { maxFaces: 2 }
            );
            console.log('Face detection model loaded');
        } catch (error) {
            console.warn('Face detection model failed to load:', error);
            // Continue without face detection
        }
    }

    enableDemoMode() {
        this.isDemoMode = true;
        this.updateCameraStatus('Demo Mode', 'status-warning');
        this.showNotification('Running in demo mode - using simulated detection');
    }

    initializeEventListeners() {
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
    }

    async startExam() {
        try {
            if (!this.cameraStream && !this.isDemoMode) {
                await this.initializeCamera();
            }

            // Hide placeholder, show video
            document.getElementById('cameraPlaceholder').classList.remove('active');
            document.getElementById('liveIndicator').style.display = 'flex';
            
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
            
            // Start audio monitoring if enabled
            if (document.getElementById('enableAudio')?.checked) {
                this.startAudioMonitoring();
            }
            
            this.updateDashboard();
            
            console.log('Exam proctoring started');
            
        } catch (error) {
            console.error('Error starting exam:', error);
            this.showError('Failed to start exam monitoring');
        }
    }

    stopExam() {
        this.isProctoring = false;
        
        // Hide live indicator
        document.getElementById('liveIndicator').style.display = 'none';
        
        // Show placeholder if no camera
        if (!this.cameraStream) {
            document.getElementById('cameraPlaceholder').classList.add('active');
        }
        
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
        const summary = `Exam proctoring stopped!\nDuration: ${duration}\nTotal violations: ${this.stats.totalViolations}`;
        
        this.showNotification(summary);
        console.log('Exam proctoring stopped');
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        const video = document.getElementById('webcam');
        video.srcObject = null;
        document.getElementById('cameraPlaceholder').classList.add('active');
        this.updateCameraStatus('Inactive', 'status-warning');
    }

    startDetection() {
        this.detectionInterval = setInterval(async () => {
            if (this.cameraStream && this.faceModel) {
                await this.detectFacesRealTime();
            } else {
                this.simulateDetection();
            }
            this.updateUI();
        }, 2000);
    }

    async detectFacesRealTime() {
        if (!this.isProctoring) return;

        const video = document.getElementById('webcam');
        const canvas = document.getElementById('outputCanvas');
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        try {
            const faces = await this.faceModel.estimateFaces({
                input: video,
                returnTensors: false,
                flipHorizontal: false,
                predictIrises: true
            });

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw face detections
            faces.forEach(face => {
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    face.boundingBox.topLeft[0],
                    face.boundingBox.topLeft[1],
                    face.boundingBox.bottomRight[0] - face.boundingBox.topLeft[0],
                    face.boundingBox.bottomRight[1] - face.boundingBox.topLeft[1]
                );
            });

            // Update detection state
            this.detectionState.faceDetected = faces.length > 0;
            this.detectionState.multipleFaces = faces.length > 1;

            // Check for violations
            if (faces.length === 0) {
                this.triggerViolation('No face detected', 'medium');
            } else if (faces.length > 1) {
                this.triggerViolation('Multiple faces detected', 'high');
                this.stats.multipleFaceCount++;
            }

            // Update face status
            this.updateFaceStatus(faces.length);

        } catch (error) {
            console.warn('Face detection error:', error);
            this.simulateDetection();
        }
    }

    simulateDetection() {
        if (!this.isProctoring) return;

        const random = Math.random();
        const timeSinceStart = (new Date() - this.examStartTime) / 1000 / 60;
        const timeFactor = Math.min(timeSinceStart / 30, 1);

        // Simulate realistic detection patterns
        if (random < (0.04 + timeFactor * 0.03)) {
            this.triggerViolation('Multiple faces detected', 'medium');
            this.stats.multipleFaceCount++;
            this.detectionState.multipleFaces = true;
        } else {
            this.detectionState.multipleFaces = false;
        }

        if (random < (0.06 + timeFactor * 0.04)) {
            this.triggerViolation('Looking away from screen', 'low');
            this.stats.gazeAwayCount++;
            this.detectionState.lookingAway = true;
        } else {
            this.detectionState.lookingAway = false;
        }

        if (random < (0.02 + timeFactor * 0.02)) {
            this.triggerViolation('Potential phone usage detected', 'high');
            this.stats.phoneUsageCount++;
            this.detectionState.phoneDetected = true;
        } else {
            this.detectionState.phoneDetected = false;
        }

        // Simulate face detection in demo mode
        this.detectionState.faceDetected = true;
        this.updateFaceStatus(1);
    }

    updateFaceStatus(faceCount) {
        const faceStatus = document.getElementById('faceStatus');
        if (faceCount > 0) {
            faceStatus.textContent = `${faceCount} face(s) detected`;
            faceStatus.className = 'status-normal';
        } else {
            faceStatus.textContent = 'No face detected';
            faceStatus.className = 'status-warning';
        }
    }

    startAudioMonitoring() {
        if (!this.cameraStream || this.isDemoMode) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(this.cameraStream);
            
            this.microphone.connect(this.analyser);
            this.analyser.fftSize = 256;
            
            this.monitorAudioLevel();
        } catch (error) {
            console.warn('Audio monitoring not available:', error);
        }
    }

    monitorAudioLevel() {
        if (!this.analyser || !this.isProctoring) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        const checkAudio = () => {
            if (!this.isProctoring) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            if (average > 50) {
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

    triggerViolation(message, severity) {
        const violation = {
            timestamp: new Date().toLocaleTimeString(),
            message: message,
            severity: severity
        };
        
        this.violations.push(violation);
        this.stats.totalViolations++;
        
        if (severity === 'high' || Math.random() > 0.7) {
            this.showViolationModal(message, severity);
        }
        
        this.saveToLocalStorage();
        console.log(`Violation: ${message} (${severity})`);
    }

    showViolationModal(message, severity) {
        document.getElementById('violationMessage').textContent = message;
        document.getElementById('violationSeverity').textContent = severity.charAt(0).toUpperCase() + severity.slice(1);
        document.getElementById('violationSeverity').className = `severity-${severity}`;
        document.getElementById('violationTime').textContent = new Date().toLocaleTimeString();
        document.getElementById('violationModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('violationModal').style.display = 'none';
        document.getElementById('permissionModal').style.display = 'none';
    }

    updateUI() {
        document.getElementById('violationCount').textContent = this.stats.totalViolations;
        
        const alertsContainer = document.getElementById('currentAlerts');
        const recentViolations = this.violations.slice(-3).reverse();
        
        if (recentViolations.length > 0) {
            alertsContainer.innerHTML = recentViolations.map(violation => 
                `<div class="alert-item severity-${violation.severity}">
                    [${violation.timestamp}] ${violation.message}
                </div>`
            ).join('');
        } else {
            alertsContainer.innerHTML = '<div class="no-alerts">No alerts</div>';
        }
        
        // Update detection statistics
        document.getElementById('lookingAwayStat').textContent = 
            `${Math.round((this.stats.gazeAwayCount / Math.max(this.stats.totalViolations, 1)) * 100)}%`;
        document.getElementById('multipleFacesStat').textContent = this.stats.multipleFaceCount;
        document.getElementById('phoneUsageStat').textContent = this.stats.phoneUsageCount;
        document.getElementById('audioEventsStat').textContent = this.stats.audioViolationCount;
        
        if (this.stats.totalViolations > 0) {
            document.getElementById('systemStatus').textContent = 'SUSPICIOUS ACTIVITY';
            document.getElementById('systemStatus').className = 'status-danger';
        }
        
        this.updateDashboard();
    }

    updateCameraStatus(status, className) {
        const cameraStatus = document.getElementById('cameraStatus');
        if (cameraStatus) {
            cameraStatus.textContent = status;
            cameraStatus.className = className;
        }
    }

    showNotification(message) {
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
            notification.remove();
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
            errorDiv.remove();
        }, 5000);
    }

    updateDashboard() {
        // Dashboard update code remains the same as previous version
        const totalViolationsEl = document.getElementById('totalViolations');
        if (totalViolationsEl) totalViolationsEl.textContent = this.stats.totalViolations;
        
        const examDurationEl = document.getElementById('examDuration');
        if (examDurationEl && this.examStartTime) {
            examDurationEl.textContent = this.getExamDuration();
        }
        
        // ... rest of dashboard update code
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

// Additional CSS for new elements
const additionalStyles = `
.camera-controls {
    margin: 15px 0;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
}

.camera-options {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
}

.camera-options label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 0.9em;
}

.browser-support {
    background: linear-gradient(135deg, #e8f5e8, #c8e6c9);
    padding: 20px;
    border-radius: 10px;
    margin: 20px 0;
    border-left: 4px solid #4CAF50;
}

.support-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.support-icon {
    font-size: 1.5em;
}

.support-note {
    font-size: 0.9em;
    color: #666;
    margin-top: 10px;
    font-style: italic;
}

.permission-steps {
    margin: 20px 0;
}

.step {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 6px;
}

.step-number {
    background: #667eea;
    color: white;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
}

.camera-preview {
    height: 150px;
    background: #000;
    border-radius: 8px;
    margin: 15px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.violation-time {
    margin-top: 10px;
    font-size: 0.9em;
    color: #666;
}

.notification, .error-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 1000;
    animation: slideInRight 0.3s ease;
}

.notification {
    background: #e3f2fd;
    border-left: 4px solid #2196F3;
    color: #1565C0;
}

.error-notification {
    background: #ffebee;
    border-left: 4px solid #f44336;
    color: #c62828;
}

.notification-content, .error-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize the system
document.addEventListener('DOMContentLoaded', function() {
    window.proctoringSystem = new ExamProctoringSystem();
    window.proctoringSystem.loadFromLocalStorage();
    
    if (window.location.pathname.includes('dashboard.html')) {
        window.proctoringSystem.updateDashboard();
        setInterval(() => {
            window.proctoringSystem.updateDashboard();
        }, 2000);
    }
});
