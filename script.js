class ExamProctoringSystem {
    constructor() {
        this.isProctoring = false;
        this.violations = [];
        this.examStartTime = null;
        this.detectionInterval = null;
        
        // Detection state
        this.detectionState = {
            faceDetected: true,
            multipleFaces: false,
            lookingAway: false,
            phoneDetected: false,
            attentionLow: false
        };
        
        // Statistics
        this.stats = {
            totalViolations: 0,
            multipleFaceCount: 0,
            gazeAwayCount: 0,
            phoneUsageCount: 0,
            attentionBreachCount: 0
        };
        
        this.initializeEventListeners();
        this.setupDemoMode();
    }

    setupDemoMode() {
        // Show demo mode indicator
        const detectionMode = document.getElementById('detectionMode');
        if (detectionMode) {
            detectionMode.textContent = 'Demo Mode';
            detectionMode.className = 'status-warning';
        }
        
        // Update instructions for demo
        console.log('Running in GitHub Pages demo mode');
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
            // Update UI for demo mode
            document.getElementById('cameraPlaceholder').innerHTML = `
                <div class="placeholder-icon">🔍</div>
                <p>Proctoring Simulation Active</p>
                <p class="placeholder-subtitle">Detecting simulated behaviors...</p>
            `;
            
            // Show live indicator
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
            
            // Update dashboard
            this.updateDashboard();
            
            console.log('Exam proctoring simulation started');
            
            // Show demo notification
            this.showDemoNotification();
            
        } catch (error) {
            console.error('Error starting exam:', error);
            this.showError('Running in demo mode. Camera access not available on GitHub Pages.');
        }
    }

    stopExam() {
        this.isProctoring = false;
        
        // Hide live indicator
        document.getElementById('liveIndicator').style.display = 'none';
        
        // Reset camera placeholder
        document.getElementById('cameraPlaceholder').innerHTML = `
            <div class="placeholder-icon">📷</div>
            <p>Camera simulation active</p>
            <p class="placeholder-subtitle">Running in demo mode on GitHub</p>
        `;
        
        // Stop detection
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }
        
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
        }, 3000); // Check every 3 seconds
    }

    simulateDetection() {
        if (!this.isProctoring) return;

        const random = Math.random();
        
        // More realistic simulation with patterns
        const timeSinceStart = (new Date() - this.examStartTime) / 1000 / 60; // minutes
        
        // Increase violation probability over time
        const timeFactor = Math.min(timeSinceStart / 30, 1); // Max at 30 minutes
        
        // Simulate different types of violations with increasing probability
        if (random < (0.03 + timeFactor * 0.04)) { // Multiple faces
            this.triggerViolation('Multiple faces detected in frame', 'medium');
            this.stats.multipleFaceCount++;
            this.detectionState.multipleFaces = true;
        } else {
            this.detectionState.multipleFaces = false;
        }
        
        if (random < (0.06 + timeFactor * 0.05)) { // Looking away
            this.triggerViolation('Student looking away from screen', 'low');
            this.stats.gazeAwayCount++;
            this.detectionState.lookingAway = true;
        } else {
            this.detectionState.lookingAway = false;
        }
        
        if (random < (0.02 + timeFactor * 0.03)) { // Phone usage
            this.triggerViolation('Potential phone usage detected', 'high');
            this.stats.phoneUsageCount++;
            this.detectionState.phoneDetected = true;
        } else {
            this.detectionState.phoneDetected = false;
        }
        
        if (random < (0.04 + timeFactor * 0.06)) { // Low attention
            this.triggerViolation('Low attention span detected', 'medium');
            this.stats.attentionBreachCount++;
            this.detectionState.attentionLow = true;
        } else {
            this.detectionState.attentionLow = false;
        }
        
        // Always detect face in simulation
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
        
        // Show violation modal for medium/high severity
        if (severity === 'high' || (severity === 'medium' && Math.random() > 0.5)) {
            this.showViolationModal(message, severity);
        }
        
        // Update localStorage for dashboard
        this.saveToLocalStorage();
        
        // Log violation
        console.log(`Violation: ${message} (${severity})`);
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

    showDemoNotification() {
        // Create a subtle demo notification
        const notification = document.createElement('div');
        notification.className = 'demo-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">🎮</span>
                <span>Running in simulation mode</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
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
        
        // Remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    updateUI() {
        // Update violation count
        document.getElementById('violationCount').textContent = this.stats.totalViolations;
        
        // Update alerts
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
            'detailAttention': this.stats.attentionBreachCount
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
    if (window.location.pathname.includes('dashboard.html') || 
        window.location.href.includes('dashboard')) {
        window.proctoringSystem.updateDashboard();
        
        // Set up periodic updates for dashboard
        setInterval(() => {
            window.proctoringSystem.updateDashboard();
        }, 2000);
    }
});

// Add CSS for new elements
const additionalStyles = `
.demo-notification, .error-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 1000;
    animation: slideInRight 0.3s ease;
}

.demo-notification {
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

.live-indicator {
    position: absolute;
    top: 15px;
    right: 15px;
    background: rgba(244, 67, 54, 0.9);
    color: white;
    padding: 5px 10px;
    border-radius: 15px;
    font-size: 0.8em;
    font-weight: bold;
    display: none;
    align-items: center;
    gap: 5px;
}

.live-dot {
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

.alert-item.severity-high { border-left-color: #f44336; background: #ffebee; }
.alert-item.severity-medium { border-left-color: #ff9800; background: #fff3e0; }
.alert-item.severity-low { border-left-color: #2196F3; background: #e3f2fd; }

.violation-log-item.severity-high { border-left-color: #f44336; }
.violation-log-item.severity-medium { border-left-color: #ff9800; }
.violation-log-item.severity-low { border-left-color: #2196F3; }

.demo-notice {
    background: linear-gradient(135deg, #e3f2fd, #bbdefb);
    padding: 20px;
    border-radius: 10px;
    margin: 20px 0;
    border-left: 4px solid #2196F3;
}

.notice-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.notice-icon {
    font-size: 1.5em;
}
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
