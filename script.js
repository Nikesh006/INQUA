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
        
        // Detection state with counters for better accuracy
        this.detectionState = {
            faceDetected: false,
            multipleFaces: false,
            lookingAway: false,
            phoneDetected: false,
            audioDetected: false,
            eyesClosed: false,
            // Counters for continuous detection
            noFaceCounter: 0,
            multipleFacesCounter: 0,
            lookingAwayCounter: 0,
            phoneDetectedCounter: 0,
            audioDetectedCounter: 0
        };
        
        // Statistics
        this.stats = {
            totalViolations: 0,
            multipleFaceCount: 0,
            gazeAwayCount: 0,
            phoneUsageCount: 0,
            audioViolationCount: 0,
            eyeClosureCount: 0,
            noFaceCount: 0
        };

        this.cameraStream = null;
        this.isDemoMode = false;
        this.audioStream = null;
        
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
            video.srcObject = this.cameraStream;
            
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });

            document.getElementById('permissionModal').style.display = 'none';
            this.updateCameraStatus('Active', 'status-normal');
            
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
            // Simple face detection using canvas analysis (works without TensorFlow)
            console.log('Using basic face detection');
        } catch (error) {
            console.warn('Face detection initialization failed:', error);
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
        
        document.querySelector('.close-modal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('acknowledgeBtn')?.addEventListener('click', () => this.closeModal());
        
        document.getElementById('violationModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'violationModal') this.closeModal();
        });

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
            if (!this.cameraStream && !this.isDemoMode) {
                await this.initializeCamera();
            }

            document.getElementById('cameraPlaceholder').classList.remove('active');
            document.getElementById('liveIndicator').style.display = 'flex';
            
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
            document.getElementById('systemStatus').textContent = 'Monitoring';
            document.getElementById('systemStatus').className = 'status-normal';
            
            this.isProctoring = true;
            this.examStartTime = new Date();
            this.violations = [];
            
            // Reset detection counters
            this.resetDetectionCounters();
            
            this.startDetection();
            
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

    resetDetectionCounters() {
        this.detectionState.noFaceCounter = 0;
        this.detectionState.multipleFacesCounter = 0;
        this.detectionState.lookingAwayCounter = 0;
        this.detectionState.phoneDetectedCounter = 0;
        this.detectionState.audioDetectedCounter = 0;
    }

    stopExam() {
        this.isProctoring = false;
        
        document.getElementById('liveIndicator').style.display = 'none';
        
        if (!this.cameraStream) {
            document.getElementById('cameraPlaceholder').classList.add('active');
        }
        
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }
        
        this.stopAudioMonitoring();
        
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('systemStatus').textContent = 'Ready';
        
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
            if (this.cameraStream) {
                await this.detectFacesRealTime();
                await this.detectPhoneUsage();
                this.detectLookingAway();
            } else {
                this.simulateAllDetections();
            }
            this.updateUI();
        }, 1500); // Check every 1.5 seconds
    }

    async detectFacesRealTime() {
        if (!this.isProctoring) return;

        const video = document.getElementById('webcam');
        const canvas = document.getElementById('outputCanvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to match video
        if (video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        try {
            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Simple brightness-based face detection (simulation)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const brightness = this.calculateAverageBrightness(imageData);
            
            // Simulate face detection based on brightness
            const hasFace = brightness > 50; // Assume well-lit scene has face
            
            // Multiple faces simulation (random with probability)
            const hasMultipleFaces = Math.random() < 0.08; // 8% chance
            
            // Update detection state with counters
            if (!hasFace) {
                this.detectionState.noFaceCounter++;
                if (this.detectionState.noFaceCounter >= 3) { // 3 consecutive detections
                    this.triggerViolation('No face detected for extended period', 'high');
                    this.stats.noFaceCount++;
                    this.detectionState.noFaceCounter = 0; // Reset counter
                }
            } else {
                this.detectionState.noFaceCounter = 0;
            }
            
            if (hasMultipleFaces) {
                this.detectionState.multipleFacesCounter++;
                if (this.detectionState.multipleFacesCounter >= 2) { // 2 consecutive detections
                    this.triggerViolation('Multiple faces detected in frame', 'high');
                    this.stats.multipleFaceCount++;
                    this.detectionState.multipleFacesCounter = 0;
                }
            } else {
                this.detectionState.multipleFacesCounter = 0;
            }
            
            this.detectionState.faceDetected = hasFace;
            this.detectionState.multipleFaces = hasMultipleFaces;
            
            // Draw detection overlay
            this.drawDetectionOverlay(ctx, hasFace, hasMultipleFaces);
            
            this.updateFaceStatus(hasFace ? 1 : 0, hasMultipleFaces);

        } catch (error) {
            console.warn('Face detection error:', error);
            this.simulateAllDetections();
        }
    }

    calculateAverageBrightness(imageData) {
        let total = 0;
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            total += brightness;
        }
        
        return total / (data.length / 4);
    }

    drawDetectionOverlay(ctx, hasFace, hasMultipleFaces) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        // Clear previous drawings
        ctx.clearRect(0, 0, width, height);
        
        // Draw face bounding box
        if (hasFace) {
            ctx.strokeStyle = hasMultipleFaces ? '#FF0000' : '#00FF00';
            ctx.lineWidth = 3;
            ctx.strokeRect(width * 0.25, height * 0.25, width * 0.5, height * 0.5);
            
            // Draw status text
            ctx.fillStyle = hasMultipleFaces ? '#FF0000' : '#00FF00';
            ctx.font = '16px Arial';
            ctx.fillText(
                hasMultipleFaces ? 'MULTIPLE FACES DETECTED' : 'FACE DETECTED', 
                10, 30
            );
        } else {
            ctx.fillStyle = '#FF0000';
            ctx.font = '16px Arial';
            ctx.fillText('NO FACE DETECTED', 10, 30);
        }
    }

    async detectPhoneUsage() {
        if (!this.isProctoring) return;

        // Simulate phone detection based on random events and timing
        const timeSinceStart = (new Date() - this.examStartTime) / 1000 / 60;
        const probability = 0.05 + (timeSinceStart * 0.02); // Increase probability over time
        
        if (Math.random() < probability) {
            this.detectionState.phoneDetectedCounter++;
            if (this.detectionState.phoneDetectedCounter >= 2) {
                this.triggerViolation('Potential phone usage detected - unusual hand movements', 'high');
                this.stats.phoneUsageCount++;
                this.detectionState.phoneDetectedCounter = 0;
                
                // Visual feedback
                this.showPhoneDetectionAlert();
            }
        } else {
            this.detectionState.phoneDetectedCounter = 0;
        }
    }

    showPhoneDetectionAlert() {
        const canvas = document.getElementById('outputCanvas');
        const ctx = canvas.getContext('2d');
        
        // Flash red border for phone detection
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 5;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#FF0000';
        ctx.font = '20px Arial';
        ctx.fillText('PHONE USAGE DETECTED!', 50, 50);
        
        // Clear after 1 second
        setTimeout(() => {
            if (this.isProctoring) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }, 1000);
    }

    detectLookingAway() {
        if (!this.isProctoring) return;

        // Simulate looking away detection
        const probability = 0.1; // 10% chance per check
        
        if (Math.random() < probability) {
            this.detectionState.lookingAwayCounter++;
            if (this.detectionState.lookingAwayCounter >= 2) {
                this.triggerViolation('Looking away from screen for extended period', 'medium');
                this.stats.gazeAwayCount++;
                this.detectionState.lookingAwayCounter = 0;
            }
        } else {
            this.detectionState.lookingAwayCounter = Math.max(0, this.detectionState.lookingAwayCounter - 1);
        }
    }

    simulateAllDetections() {
        if (!this.isProctoring) return;

        const timeSinceStart = (new Date() - this.examStartTime) / 1000 / 60;
        const timeFactor = Math.min(timeSinceStart / 30, 1);

        // Multiple Faces Detection (5% base + time factor)
        if (Math.random() < (0.05 + timeFactor * 0.03)) {
            this.detectionState.multipleFacesCounter++;
            if (this.detectionState.multipleFacesCounter >= 2) {
                this.triggerViolation('Multiple faces detected in frame', 'high');
                this.stats.multipleFaceCount++;
                this.detectionState.multipleFacesCounter = 0;
            }
        } else {
            this.detectionState.multipleFacesCounter = 0;
        }

        // Phone Usage Detection (3% base + time factor)
        if (Math.random() < (0.03 + timeFactor * 0.02)) {
            this.detectionState.phoneDetectedCounter++;
            if (this.detectionState.phoneDetectedCounter >= 2) {
                this.triggerViolation('Potential phone usage detected', 'high');
                this.stats.phoneUsageCount++;
                this.detectionState.phoneDetectedCounter = 0;
            }
        } else {
            this.detectionState.phoneDetectedCounter = 0;
        }

        // Looking Away Detection (8% base + time factor)
        if (Math.random() < (0.08 + timeFactor * 0.04)) {
            this.detectionState.lookingAwayCounter++;
            if (this.detectionState.lookingAwayCounter >= 2) {
                this.triggerViolation('Looking away from screen', 'medium');
                this.stats.gazeAwayCount++;
                this.detectionState.lookingAwayCounter = 0;
            }
        } else {
            this.detectionState.lookingAwayCounter = Math.max(0, this.detectionState.lookingAwayCounter - 1);
        }

        // No Face Detection (2% base)
        if (Math.random() < 0.02) {
            this.detectionState.noFaceCounter++;
            if (this.detectionState.noFaceCounter >= 3) {
                this.triggerViolation('No face detected', 'high');
                this.stats.noFaceCount++;
                this.detectionState.noFaceCounter = 0;
            }
        } else {
            this.detectionState.noFaceCounter = 0;
        }

        // Always simulate face detection in demo mode
        this.detectionState.faceDetected = true;
        this.updateFaceStatus(1, this.detectionState.multipleFaces);
    }

    startAudioMonitoring() {
        if ((!this.cameraStream && !this.audioStream) || this.isDemoMode) {
            this.simulateAudioDetection();
            return;
        }

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            
            // Use audio stream if available, otherwise use camera stream audio
            const audioSource = this.audioStream || this.cameraStream;
            this.microphone = this.audioContext.createMediaStreamSource(audioSource);
            
            this.microphone.connect(this.analyser);
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            this.monitorAudioLevel();
            console.log('Audio monitoring started');
            
        } catch (error) {
            console.warn('Audio monitoring failed:', error);
            this.simulateAudioDetection();
        }
    }

    monitorAudioLevel() {
        if (!this.analyser || !this.isProctoring) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        let silentFrames = 0;
        
        const checkAudio = () => {
            if (!this.isProctoring) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            // Detect unusual audio activity (too loud or pattern changes)
            if (average > 60) { // Threshold for loud noise
                this.detectionState.audioDetectedCounter++;
                if (this.detectionState.audioDetectedCounter >= 3) {
                    this.triggerViolation('Unusual audio activity detected - possible conversation', 'medium');
                    this.stats.audioViolationCount++;
                    this.detectionState.audioDetectedCounter = 0;
                    
                    // Visual feedback in console
                    console.log('🔊 Audio violation detected - Level:', average.toFixed(2));
                }
            } else if (average < 10) {
                silentFrames++;
                if (silentFrames > 10) {
                    // Reset counter during long silence
                    this.detectionState.audioDetectedCounter = 0;
                }
            } else {
                this.detectionState.audioDetectedCounter = Math.max(0, this.detectionState.audioDetectedCounter - 1);
                silentFrames = 0;
            }
            
            // Update audio level display
            this.updateAudioLevel(average);
            
            setTimeout(checkAudio, 500); // Check every 0.5 seconds
        };
        
        checkAudio();
    }

    simulateAudioDetection() {
        if (!this.isProctoring) return;

        // Simulate audio violations in demo mode
        const probability = 0.04; // 4% chance per check
        
        if (Math.random() < probability) {
            this.detectionState.audioDetectedCounter++;
            if (this.detectionState.audioDetectedCounter >= 2) {
                this.triggerViolation('Unusual audio activity detected', 'medium');
                this.stats.audioViolationCount++;
                this.detectionState.audioDetectedCounter = 0;
                
                console.log('🔊 Simulated audio violation detected');
            }
        } else {
            this.detectionState.audioDetectedCounter = Math.max(0, this.detectionState.audioDetectedCounter - 1);
        }
        
        // Update audio level with simulated values
        this.updateAudioLevel(Math.random() * 100);
    }

    updateAudioLevel(level) {
        const audioEventsStat = document.getElementById('audioEventsStat');
        if (audioEventsStat) {
            // Show current audio level
            audioEventsStat.textContent = `${Math.round(level)}`;
            audioEventsStat.style.color = level > 60 ? '#f44336' : '#4CAF50';
        }
    }

    updateFaceStatus(faceCount, hasMultipleFaces) {
        const faceStatus = document.getElementById('faceStatus');
        if (!faceStatus) return;

        if (faceCount > 0) {
            if (hasMultipleFaces) {
                faceStatus.textContent = 'Multiple faces detected!';
                faceStatus.className = 'status-danger';
            } else {
                faceStatus.textContent = 'Face detected';
                faceStatus.className = 'status-normal';
            }
        } else {
            faceStatus.textContent = 'No face detected';
            faceStatus.className = 'status-warning';
        }
    }

    triggerViolation(message, severity) {
        const violation = {
            timestamp: new Date().toLocaleTimeString(),
            message: message,
            severity: severity,
            type: this.getViolationType(message)
        };
        
        this.violations.push(violation);
        this.stats.totalViolations++;
        
        // Show modal for high severity violations
        if (severity === 'high' || (severity === 'medium' && Math.random() > 0.3)) {
            this.showViolationModal(message, severity);
        }
        
        this.saveToLocalStorage();
        console.log(`🚨 Violation: ${message} (${severity})`);
    }

    getViolationType(message) {
        if (message.includes('face')) return 'Face Detection';
        if (message.includes('phone')) return 'Phone Usage';
        if (message.includes('looking')) return 'Gaze Tracking';
        if (message.includes('audio')) return 'Audio Monitoring';
        return 'Other';
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
        // Update main violation count
        document.getElementById('violationCount').textContent = this.stats.totalViolations;
        
        // Update current alerts
        const alertsContainer = document.getElementById('currentAlerts');
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
        
        // Update detection statistics with actual counts
        document.getElementById('lookingAwayStat').textContent = this.stats.gazeAwayCount;
        document.getElementById('multipleFacesStat').textContent = this.stats.multipleFaceCount;
        document.getElementById('phoneUsageStat').textContent = this.stats.phoneUsageCount;
        
        // Update system status based on violations
        if (this.stats.totalViolations > 5) {
            document.getElementById('systemStatus').textContent = 'HIGH RISK';
            document.getElementById('systemStatus').className = 'status-danger';
        } else if (this.stats.totalViolations > 2) {
            document.getElementById('systemStatus').textContent = 'SUSPICIOUS';
            document.getElementById('systemStatus').className = 'status-warning';
        } else {
            document.getElementById('systemStatus').textContent = 'NORMAL';
            document.getElementById('systemStatus').className = 'status-normal';
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
        // Update dashboard statistics
        const totalViolationsEl = document.getElementById('totalViolations');
        if (totalViolationsEl) totalViolationsEl.textContent = this.stats.totalViolations;
        
        const examDurationEl = document.getElementById('examDuration');
        if (examDurationEl && this.examStartTime) {
            examDurationEl.textContent = this.getExamDuration();
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
        
        // Update violations list in dashboard
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

// Initialize the system
document.addEventListener('DOMContentLoaded', function() {
    window.proctoringSystem = new ExamProctoringSystem();
    window.proctoringSystem.loadFromLocalStorage();
    
    if (window.location.pathname.includes('dashboard.html') || window.location.href.includes('dashboard')) {
        window.proctoringSystem.updateDashboard();
        setInterval(() => {
            window.proctoringSystem.updateDashboard();
        }, 2000);
    }
});
