'use client'

import { useState, useEffect } from 'react'
import { Eye, Bell, Pause, Play, RotateCcw, Volume2, VolumeX, ShieldAlert } from 'lucide-react'

export function EyeBreakReminder() {
  const [enabled, setEnabled] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20 * 60) // 20 minutes in seconds
  const [isActive, setIsActive] = useState(false)
  const [isBreakTime, setIsBreakTime] = useState(false)
  const [breakTimer, setBreakTimer] = useState(20) // 20 seconds
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      setNotificationPermission(perm)
    }
  }

  const playBeep = () => {
    if (!soundEnabled || typeof window === 'undefined') return
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime) // D5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.8)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.8)
    } catch {
      // AudioContext policy suppression fallback
    }
  }

  // Work countdown timer
  useEffect(() => {
    let interval: any = null
    if (enabled && isActive && !isBreakTime) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Trigger 20-20-20 break
            setIsBreakTime(true)
            setBreakTimer(20)
            playBeep()

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('EyeGuard 20-20-20 Reminder', {
                body: 'Time to rest your eyes! Look at an object 20 feet away for 20 seconds.',
                icon: '/icon.svg',
              })
            }
            return 20 * 60
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [enabled, isActive, isBreakTime, soundEnabled])

  // Break countdown timer (20 seconds)
  useEffect(() => {
    let interval: any = null
    if (isBreakTime) {
      interval = setInterval(() => {
        setBreakTimer((prev) => {
          if (prev <= 1) {
            setIsBreakTime(false)
            playBeep()
            return 20
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isBreakTime, soundEnabled])

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remSecs = secs % 60
    return `${mins}:${remSecs < 10 ? '0' : ''}${remSecs}`
  }

  const toggleReminder = () => {
    if (!enabled) {
      setEnabled(true)
      setIsActive(true)
      if (notificationPermission === 'default') {
        requestPermission()
      }
    } else {
      setEnabled(false)
      setIsActive(false)
      setIsBreakTime(false)
      setTimeLeft(20 * 60)
    }
  }

  return (
    <>
      {/* Break overlay modal when 20 seconds active */}
      {isBreakTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-card border-2 border-primary rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse">
              <Eye className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">20-20-20 Eye Break!</h3>
            <p className="text-muted-foreground text-sm">
              Look away from the screen at an object approximately <span className="font-semibold text-foreground">20 feet (6 meters)</span> away to relax your ciliary muscles.
            </p>
            <div className="text-5xl font-black text-primary font-mono py-2">
              {breakTimer}s
            </div>
            <button
              onClick={() => setIsBreakTime(false)}
              className="text-xs text-muted-foreground hover:text-foreground underline pt-2"
            >
              Skip break for now
            </button>
          </div>
        </div>
      )}

      {/* Persistent Widget in Bottom Right corner */}
      <div className="fixed bottom-28 right-6 z-40 bg-card border border-border shadow-lg rounded-xl p-3 flex items-center gap-3 text-xs">
        <button
          onClick={toggleReminder}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            enabled
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
          title="Toggle 20-20-20 break companion"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{enabled ? '20-20-20 ON' : 'Start 20-20-20'}</span>
        </button>

        {enabled && (
          <>
            <span className="font-mono font-semibold text-foreground">
              {formatTime(timeLeft)}
            </span>
            <button
              onClick={() => setIsActive(!isActive)}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              title={isActive ? 'Pause' : 'Resume'}
            >
              {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setTimeLeft(20 * 60)}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </div>
    </>
  )
}
