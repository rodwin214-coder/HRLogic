import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { GeolocationData, AttendanceRecord, Task, TaskStatus } from '../../types';
import * as api from '../../services/supabaseApi';
import { UserContext } from '../../App';
import Modal from '../common/Modal';

// --- Task Update Modal Component ---
interface TaskUpdateOnClockOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClockOut: (notes: string) => void;
}

const TaskUpdateOnClockOutModal: React.FC<TaskUpdateOnClockOutModalProps> = ({ isOpen, onClose, onConfirmClockOut }) => {
    const { user } = useContext(UserContext);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [endOfDayNotes, setEndOfDayNotes] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            const loadTasks = async () => {
                const allTasks = await api.getTasksForEmployee(user.id);
                const inProgressTasks = allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS);
                setTasks(inProgressTasks);
            };
            loadTasks();
        }
    }, [isOpen, user]);

    const handleStatusUpdate = async (task: Task, newStatus: TaskStatus) => {
        const updatedTask = { ...task, status: newStatus };
        if (newStatus === TaskStatus.COMPLETED) {
            updatedTask.dateCompleted = new Date().toISOString();
        }
        await api.updateTask(updatedTask);
        // Refresh list
        setTasks(prev => prev.filter(t => t.id !== task.id));
    };

    const handleConfirm = () => {
        onConfirmClockOut(endOfDayNotes);
        setEndOfDayNotes('');
    }

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="End of Shift Summary">
            <div className="space-y-4">
                {tasks.length > 0 ? (
                    <div>
                        <h3 className="font-semibold text-slate-800 mb-2">Update In-Progress Tasks</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border rounded-md">
                            {tasks.map(task => (
                                <div key={task.id} className="p-2 border-b flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-medium">{task.title}</p>
                                        <p className="text-xs text-slate-500">Due: {task.dueDate}</p>
                                    </div>
                                    <button
                                        onClick={() => handleStatusUpdate(task, TaskStatus.COMPLETED)}
                                        className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-md hover:bg-green-200"
                                    >
                                        Mark as Completed
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 text-center p-4 bg-slate-50 rounded-md">No tasks currently in progress. Great job!</p>
                )}
                 <div>
                    <label className="block text-sm font-medium text-slate-700">End of Day Notes (Optional)</label>
                    <textarea 
                        value={endOfDayNotes} 
                        onChange={e => setEndOfDayNotes(e.target.value)} 
                        rows={3} 
                        className="mt-1 input-field"
                        placeholder="Summarize what you've accomplished today..."
                    ></textarea>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="button" onClick={handleConfirm} className="btn btn-primary">Proceed to Clock Out</button>
                </div>
            </div>
        </Modal>
    );
};


// Helper to format date/time
const formatTime = (dateString?: string): string => {
    if (!dateString) return '- - : - -';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Helper to calculate total hours worked
const calculateTotalHours = (start?: string, end?: string): string => {
    if (!start || !end) return 'N/A';
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (isNaN(startTime) || isNaN(endTime) || endTime < startTime) return 'N/A';
    
    const diff = (endTime - startTime) / 1000; // in seconds
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m`;
};

// FIX: Added ClockInOutProps interface to define component props and resolve TypeScript error.
interface ClockInOutProps {
    todaysRecord: AttendanceRecord | undefined;
    onUpdate: () => void;
}

const ClockInOut: React.FC<ClockInOutProps> = ({ todaysRecord, onUpdate }) => {
    const { user } = useContext(UserContext);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [photo, setPhoto] = useState<string | null>(null);
    const [currentLocation, setCurrentLocation] = useState<GeolocationData | null>(null);
    const [locationError, setLocationError] = useState('');
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [allTodaysSessions, setAllTodaysSessions] = useState<AttendanceRecord[]>([]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const isClockedIn = !!todaysRecord && !todaysRecord.clockOutTime;
    const isClockedOut = !!todaysRecord?.clockOutTime;

    // Live clock timer and midnight reset detection
    useEffect(() => {
        let lastDate = new Date().toDateString();

        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);

            // Check if date has changed (midnight passed)
            const currentDate = now.toDateString();
            if (currentDate !== lastDate) {
                lastDate = currentDate;
                // Date changed - trigger refresh to clear old sessions
                onUpdate();
                setAllTodaysSessions([]);
                setPhoto(null);
                setCurrentLocation(null);
                setIsCameraOn(false);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [onUpdate]);

    // Load all today's sessions (including any unclosed session from previous days)
    useEffect(() => {
        const loadAllSessions = async () => {
            if (user) {
                const sessions = await api.getTodaysAllAttendance(user.id);
                // Include all sessions returned (today's sessions + any unclosed previous sessions)
                setAllTodaysSessions(sessions);
            }
        };
        loadAllSessions();
    }, [user, todaysRecord]);

    // Camera cleanup function
    const cleanupCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);
    
    // Effect to handle starting/stopping camera stream
    useEffect(() => {
        if (isCameraOn) {
            const enableStream = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        await videoRef.current.play();
                    }
                } catch (err) {
                    console.error(err);
                    setError('Camera access denied. Please allow camera permissions in your browser settings.');
                    setIsCameraOn(false);
                }
            };
            enableStream();
        } else {
            cleanupCamera();
        }

        return () => {
            cleanupCamera();
        };
    }, [isCameraOn, cleanupCamera]);

    // Get user's current location
    const updateLocation = useCallback(() => {
        setLocationError('');
        setCurrentLocation(null);
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCurrentLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                let errorMsg = 'Unable to retrieve location.';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = 'Location permission denied. Please enable location access.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMsg = 'Location request timed out. Please try again.';
                        break;
                }
                setLocationError(errorMsg);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }, []);

    // Start the camera feed by toggling state
    const startCamera = useCallback(() => {
        setPhoto(null);
        setError('');
        updateLocation();
        setIsCameraOn(true);
    }, [updateLocation]);
    
    // Capture a photo from the video stream
    const capturePhoto = useCallback(() => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const context = canvas.getContext('2d');
            if(context){
                // Flip the image horizontally for a mirror effect to match the preview
                context.translate(canvas.width, 0);
                context.scale(-1, 1);
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setPhoto(dataUrl);
            }
            setIsCameraOn(false); // This will trigger the useEffect to clean up the camera
        } else {
            setError("Camera not ready, please try again.");
        }
    }, []);

    const performClockOut = async (notes: string) => {
        if (!user) return;
        await api.clockOut(user.id, {
            clockOutPhoto: photo!,
            clockOutLocation: currentLocation!,
            endOfDayNotes: notes,
        });
        onUpdate();
        setPhoto(null);
        setCurrentLocation(null);
        setIsTaskModalOpen(false);
    };

    // Handle the clock in/out submission
    const handleClockAction = async () => {
        if (!user) return;
        
        try {
            if (!photo) {
                throw new Error('Please take a photo first.');
            }
            if (!currentLocation) {
                throw new Error(locationError || 'Location is required. Please enable location services.');
            }

            if (!isClockedIn) { // Clocking In
                setLoading(true);
                const record = {
                    employeeId: user.id,
                    clockInTime: new Date().toISOString(),
                    clockInPhoto: photo,
                    clockInLocation: currentLocation,
                };
                await api.clockIn(record, user.companyId);
                onUpdate();
                setPhoto(null);
                setCurrentLocation(null);
                setLoading(false);
            } else { // Clocking Out - Check for tasks
                const tasks = await api.getTasksForEmployee(user.id);
                if (tasks.some(t => t.status === TaskStatus.IN_PROGRESS)) {
                    setIsTaskModalOpen(true);
                } else {
                     await performClockOut('');
                }
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
            setLoading(false);
        }
    };

    const statusText = isClockedIn ? 'Clocked In' : 'Ready to Clock In';
    const statusColor = isClockedIn ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';

    return (
        <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
            <TaskUpdateOnClockOutModal
                isOpen={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                onConfirmClockOut={performClockOut}
            />

            <h2 className="text-xl font-bold text-slate-800">Time Clock</h2>

            {/* Current Status */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Current Status</span>
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${statusColor}`}>{statusText}</span>
                </div>
            </div>

            {/* All Sessions for Today */}
            {allTodaysSessions.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-3">
                        Today's Sessions ({allTodaysSessions.length})
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {allTodaysSessions.map((session, index) => {
                            const isActiveSession = session.id === todaysRecord?.id && !session.clockOutTime;
                            const isFirstSession = index === 0;
                            const sessionDate = new Date(session.clockInTime).toDateString();
                            const isToday = sessionDate === new Date().toDateString();
                            const isPreviousDay = !isToday;
                            return (
                                <div
                                    key={session.id}
                                    className={`p-3 rounded-md border ${
                                        isActiveSession ? 'bg-blue-50 border-blue-300' :
                                        isPreviousDay ? 'bg-yellow-50 border-yellow-300' :
                                        'bg-white border-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-slate-500">Session {index + 1}</span>
                                            {isPreviousDay && (
                                                <span className="text-xs text-orange-600 font-medium">
                                                    ({new Date(session.clockInTime).toLocaleDateString()})
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isFirstSession && session.status && (
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                                                    session.status === 'On Time'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {session.status}
                                                </span>
                                            )}
                                            {isActiveSession && (
                                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                                                    Active
                                                </span>
                                            )}
                                            {isPreviousDay && !session.clockOutTime && (
                                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-100 text-orange-800">
                                                    Unclosed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Clock In:</span>
                                            <span className="text-slate-800 font-mono">{formatTime(session.clockInTime)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Clock Out:</span>
                                            <span className="text-slate-800 font-mono">{formatTime(session.clockOutTime)}</span>
                                        </div>
                                        <div className="flex justify-between pt-1 border-t">
                                            <span className="text-slate-600 font-semibold">Duration:</span>
                                            <span className="text-slate-800 font-bold">{calculateTotalHours(session.clockInTime, session.clockOutTime)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-300">
                        <div className="flex justify-between">
                            <span className="text-slate-700 font-bold">Total Hours Today:</span>
                            <span className="text-slate-800 font-bold">
                                {(() => {
                                    let totalSeconds = 0;
                                    allTodaysSessions.forEach(session => {
                                        if (session.clockOutTime) {
                                            const start = new Date(session.clockInTime).getTime();
                                            const end = new Date(session.clockOutTime).getTime();
                                            totalSeconds += (end - start) / 1000;
                                        }
                                    });
                                    const hours = Math.floor(totalSeconds / 3600);
                                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                                    return `${hours}h ${minutes}m`;
                                })()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {isClockedOut && (
                 <div className="text-center p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 mb-4">
                    <p className="font-semibold">Session Completed</p>
                    <p className="text-sm mt-1">You have clocked out from your current session.</p>
                    <p className="text-xs mt-2 text-green-600">Click "Start Camera" below to begin a new session.</p>
                </div>
            )}

            {/* Camera/Photo View */}
            <div className="relative aspect-video bg-slate-900 rounded-md overflow-hidden flex items-center justify-center text-slate-400">
                {photo ? (
                    <img src={photo} alt="Your selfie" className="w-full h-full object-cover" />
                ) : isCameraOn ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]"></video>
                ) : (
                     <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p>Camera is off</p>
                    </div>
                )}

                {/* Timestamp and Location Overlay */}
                {(isCameraOn || photo) && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-2 backdrop-blur-sm">
                        <p className="font-mono text-center tracking-wider">{currentTime.toLocaleString()}</p>
                        {currentLocation ? (
                            <>
                                <p className="font-mono text-center">
                                    {`Lat: ${currentLocation.latitude.toFixed(5)}, Lon: ${currentLocation.longitude.toFixed(5)}`}
                                </p>
                                {currentLocation.accuracy !== undefined && (
                                    <p className={`text-center text-xs mt-1 ${currentLocation.accuracy <= 50 ? 'text-green-400' : currentLocation.accuracy <= 100 ? 'text-yellow-400' : 'text-orange-400'}`}>
                                        Accuracy: ±{currentLocation.accuracy.toFixed(0)}m {currentLocation.accuracy <= 50 ? '(Excellent)' : currentLocation.accuracy <= 100 ? '(Good)' : '(Fair)'}
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-yellow-400 text-center">{locationError || 'Acquiring location...'}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
                {!isCameraOn && !photo ? (
                    <button onClick={startCamera} className="w-full bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition-colors font-semibold">
                        Start Camera
                    </button>
                ) : isCameraOn ? (
                    <button onClick={capturePhoto} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-semibold">
                        Take Photo
                    </button>
                ) : ( // Photo taken, show preview options
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={startCamera} className="w-full bg-slate-500 text-white px-4 py-3 rounded-md hover:bg-slate-600 transition-colors font-semibold">
                            Retake
                        </button>
                        <button
                            onClick={handleClockAction}
                            disabled={!currentLocation || loading}
                            className={`w-full text-white font-bold py-3 px-4 rounded-md transition-all duration-200 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed ${isClockedIn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            {loading ? 'Processing...' : (isClockedIn ? 'Confirm Clock Out' : 'Confirm Clock In')}
                        </button>
                    </div>
                )}
            </div>
            {error && <p className="text-red-600 text-sm mt-2 text-center bg-red-50 p-2 rounded-md border border-red-200">{error}</p>}
        </div>
    );
};

export default ClockInOut;