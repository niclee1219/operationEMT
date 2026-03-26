import { useState, useCallback, useRef, useEffect } from 'react'
import useWebSocket from './hooks/useWebSocket'
import CallQueue from './components/CallQueue'
import LiveTranscript from './components/LiveTranscript'
import PatientForm from './components/PatientForm'
import TriagePanel from './components/TriagePanel'
import EscalationAlert from './components/EscalationAlert'
import SmartHoldButton from './components/SmartHoldButton'

// ─── NEHR mock profiles — picked by name length mod pool size ───────────────
const NEHR_PROFILES = [
  {
    bloodType: 'O+',
    knownConditions: ['Hypertension', 'Type 2 Diabetes', 'Dyslipidemia'],
    allergies: ['Penicillin', 'Sulfa drugs'],
    medications: ['Metformin 500mg', 'Amlodipine 5mg', 'Atorvastatin 20mg'],
    lastAdmission: '03 Nov 2024',
    nric: 'S7234***C',
  },
  {
    bloodType: 'A+',
    knownConditions: ['Asthma', 'GERD'],
    allergies: ['Aspirin'],
    medications: ['Salbutamol inhaler', 'Omeprazole 20mg'],
    lastAdmission: '15 Jun 2023',
    nric: 'S8456***F',
  },
  {
    bloodType: 'B-',
    knownConditions: ['Coronary Artery Disease', 'Atrial Fibrillation'],
    allergies: ['Codeine', 'Iodine contrast'],
    medications: ['Warfarin 3mg', 'Bisoprolol 2.5mg', 'Aspirin 100mg'],
    lastAdmission: '20 Jan 2025',
    nric: 'S6523***A',
  },
  {
    bloodType: 'AB+',
    knownConditions: ['Chronic Kidney Disease Stage 3', 'Anaemia'],
    allergies: ['NSAIDs'],
    medications: ['Erythropoietin injection', 'Ferrous sulphate 200mg'],
    lastAdmission: '30 Aug 2024',
    nric: 'S7891***D',
  },
  {
    bloodType: 'O-',
    knownConditions: ['None on record'],
    allergies: ['None known'],
    medications: ['None on record'],
    lastAdmission: 'No prior admission',
    nric: 'S9012***G',
  },
  {
    bloodType: 'A-',
    knownConditions: ['Parkinson\'s Disease', 'Osteoporosis'],
    allergies: ['Latex', 'Shellfish (anaphylaxis)'],
    medications: ['Levodopa/Carbidopa 100/25mg', 'Calcium 600mg', 'Vit D3'],
    lastAdmission: '11 Mar 2025',
    nric: 'S5678***H',
  },
]

function mockNehrData(name = '') {
  const idx = name.length % NEHR_PROFILES.length
  return NEHR_PROFILES[idx]
}

function makeEmptyCall(call_id) {
  return {
    call_id,
    status: 'ringing',    // ringing → active → smart_hold | ended
    messages: [],         // [{text, timestamp}]
    pendingText: '',
    patient: { name: null, age: null, location: null },
    condition: null,
    differentials: [],
    pacs: null,
    confirmed: false,
    aiFields: new Set(),
    nehrStatus: null,
    nehrData: null,
    allergies: [],
    past_conditions: [],
    additional_notes: null,
    startedAt: Date.now() / 1000,
    answeredAt: null,
  }
}

// ─── Incoming call banner ────────────────────────────────────────────────────
function IncomingBanner({ ringingCalls, hasActiveCall, onAnswer }) {
  if (ringingCalls.length === 0) return null
  return (
    <div style={{
      background: '#7c2d12',
      borderBottom: '2px solid #ea580c',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      animation: 'ringPulse 1s ease-in-out infinite',
    }}>
      <style>{`@keyframes ringPulse { 0%,100%{opacity:1} 50%{opacity:0.7} }`}</style>
      <span style={{ fontSize: '18px' }}>📞</span>
      <div style={{ flex: 1 }}>
        <span style={{ color: '#fed7aa', fontWeight: 700, fontSize: '14px' }}>
          Incoming call{ringingCalls.length > 1 ? ` (${ringingCalls.length})` : ''} —
        </span>
        <span style={{ color: '#fdba74', fontSize: '13px', marginLeft: '6px' }}>
          {ringingCalls[0].call_id}
        </span>
      </div>
      <button
        onClick={() => onAnswer(ringingCalls[0].call_id)}
        disabled={hasActiveCall}
        style={{
          padding: '7px 18px',
          borderRadius: '6px',
          border: 'none',
          background: hasActiveCall ? '#374151' : '#16a34a',
          color: hasActiveCall ? '#6b7280' : '#fff',
          fontWeight: 700,
          fontSize: '13px',
          cursor: hasActiveCall ? 'not-allowed' : 'pointer',
          letterSpacing: '0.05em',
        }}
      >
        {hasActiveCall ? 'Finish Active Call' : 'Answer'}
      </button>
    </div>
  )
}

// ─── Call detail header (duration + end call) ────────────────────────────────
function CallHeader({ call, onEndCall }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!call || call.status === 'ended') return
    const ref = call.answeredAt || call.startedAt
    const tick = () => setElapsed(Math.floor(Date.now() / 1000 - ref))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [call?.call_id, call?.answeredAt, call?.status])

  if (!call) return null

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const startTime = new Date(call.startedAt * 1000).toLocaleTimeString('en-SG', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  const statusLabel = {
    ringing: '🔔 Ringing',
    active: '🟢 Live',
    smart_hold: '🔵 AI Hold',
    ended: '⚫ Ended',
  }[call.status] ?? call.status

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 16px',
      borderBottom: '1px solid #1e293b',
      background: '#0f172a',
    }}>
      <span style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>
        {call.call_id}
      </span>
      <span style={{ fontSize: '12px', color: '#64748b' }}>Started {startTime}</span>
      {call.status !== 'ended' && (
        <span style={{ fontSize: '13px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
          {mm}:{ss}
        </span>
      )}
      <span style={{ fontSize: '12px', color: '#64748b' }}>{statusLabel}</span>
      <div style={{ flex: 1 }} />
      {call.status !== 'ended' && (
        <button
          onClick={() => onEndCall(call.call_id)}
          style={{
            padding: '5px 14px',
            borderRadius: '5px',
            border: '1px solid #dc2626',
            background: 'transparent',
            color: '#f87171',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          End Call
        </button>
      )}
    </div>
  )
}

export default function App() {
  const [calls, setCalls] = useState(new Map())
  const [selectedCallId, setSelectedCallId] = useState(null)
  const [activeAlert, setActiveAlert] = useState(null)
  const aiFieldTimers = useRef({})

  useEffect(() => {
    return () => { Object.values(aiFieldTimers.current).forEach(clearTimeout) }
  }, [])

  const { sendMessage } = useWebSocket(useCallback((msg) => {
    const { type, call_id } = msg

    if (type === 'call_started') {
      setCalls(prev => {
        if (prev.has(call_id)) return prev
        const next = new Map(prev)
        next.set(call_id, { ...makeEmptyCall(call_id), startedAt: msg.timestamp || Date.now() / 1000 })
        return next
      })

    } else if (type === 'transcript_delta') {
      setCalls(prev => {
        const call = prev.get(call_id)
        if (!call) return prev
        const next = new Map(prev)
        if (msg.is_final) {
          const last = call.messages[call.messages.length - 1]
          const gap = last ? (msg.timestamp - last.timestamp) : Infinity
          const newMessages = (!last || gap > 3)
            ? [...call.messages, { text: msg.text, timestamp: msg.timestamp }]
            : [...call.messages.slice(0, -1), { ...last, text: last.text + ' ' + msg.text }]
          next.set(call_id, { ...call, messages: newMessages, pendingText: '' })
        } else {
          next.set(call_id, { ...call, pendingText: msg.text })
        }
        return next
      })

    } else if (type === 'extraction_update') {
      setCalls(prev => {
        const call = prev.get(call_id)
        if (!call) return prev
        const next = new Map(prev)
        const updatedFields = msg.fields_updated || []
        const newAiFields = new Set(call.aiFields)
        updatedFields.forEach(f => newAiFields.add(f))

        const nameJustAppeared = !call.patient?.name && !!msg.patient?.name
        const nehrStatus = nameJustAppeared && call.nehrStatus === null ? 'loading' : call.nehrStatus

        next.set(call_id, {
          ...call,
          patient: msg.patient ?? call.patient,
          condition: msg.condition ?? call.condition,
          differentials: msg.differentials ?? call.differentials,
          pacs: msg.pacs ?? call.pacs,
          confirmed: msg.confirmed ?? call.confirmed,
          aiFields: newAiFields,
          nehrStatus,
          allergies: (msg.allergies && msg.allergies.length > 0) ? msg.allergies : call.allergies,
          past_conditions: (msg.past_conditions && msg.past_conditions.length > 0) ? msg.past_conditions : call.past_conditions,
          additional_notes: msg.additional_notes ?? call.additional_notes,
        })

        if (nameJustAppeared && call.nehrStatus === null) {
          setTimeout(() => {
            setCalls(c => {
              const cc = c.get(call_id)
              if (!cc) return c
              const nm = new Map(c)
              nm.set(call_id, { ...cc, nehrStatus: 'loaded', nehrData: mockNehrData(msg.patient.name) })
              return nm
            })
          }, 1500)
        }

        // Clear AI flash after 3s
        updatedFields.forEach(field => {
          const key = `${call_id}:${field}`
          clearTimeout(aiFieldTimers.current[key])
          aiFieldTimers.current[key] = setTimeout(() => {
            setCalls(c => {
              const cc = c.get(call_id)
              if (!cc) return c
              const nf = new Set(cc.aiFields)
              nf.delete(field)
              const nm = new Map(c)
              nm.set(call_id, { ...cc, aiFields: nf })
              return nm
            })
          }, 3000)
        })
        return next
      })

    } else if (type === 'escalation_alert') {
      setActiveAlert({ call_id, ...msg })

    } else if (type === 'call_status_changed') {
      setCalls(prev => {
        const call = prev.get(call_id)
        if (!call) return prev
        const next = new Map(prev)
        next.set(call_id, { ...call, status: msg.status })
        return next
      })

    } else if (type === 'call_ended') {
      setCalls(prev => {
        const call = prev.get(call_id)
        if (!call) return prev
        const next = new Map(prev)
        next.set(call_id, { ...call, status: 'ended', pendingText: '' })
        return next
      })
    }
  }, []))

  function handleAnswer(call_id) {
    setCalls(prev => {
      const call = prev.get(call_id)
      if (!call) return prev
      const next = new Map(prev)
      next.set(call_id, { ...call, status: 'active', answeredAt: Date.now() / 1000 })
      return next
    })
    setSelectedCallId(call_id)
  }

  function handleEndCall(call_id) {
    sendMessage('end_call', { call_id })
  }

  const callsArray = Array.from(calls.values())
  const activeCalls = callsArray.filter(c => c.status !== 'ended')
  const pastCalls = callsArray.filter(c => c.status === 'ended')
  const ringingCalls = activeCalls.filter(c => c.status === 'ringing')
  const hasActiveCall = activeCalls.some(c => c.status === 'active' || c.status === 'smart_hold')
  const selectedCall = calls.get(selectedCallId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      <EscalationAlert
        alert={activeAlert}
        callLabel={activeAlert ? (calls.get(activeAlert.call_id)?.patient?.name || calls.get(activeAlert.call_id)?.condition || 'New Call') : null}
        onResumeCall={(id) => {
          sendMessage('resume_call', { call_id: id })
          setActiveAlert(null)
        }}
      />

      <IncomingBanner
        ringingCalls={ringingCalls}
        hasActiveCall={hasActiveCall}
        onAnswer={handleAnswer}
      />

      {callsArray.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📡</div>
            <div style={{ fontSize: '18px' }}>Waiting for incoming calls…</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>Connect a caller to begin</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <CallQueue
            activeCalls={activeCalls}
            pastCalls={pastCalls}
            selectedCallId={selectedCallId}
            alertCallId={activeAlert?.call_id}
            onSelect={setSelectedCallId}
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selectedCall ? (
              <>
                <CallHeader call={selectedCall} onEndCall={handleEndCall} />
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflowY: 'auto' }}>
                    <LiveTranscript messages={selectedCall.messages} pendingText={selectedCall.pendingText} />
                    <PatientForm
                      patient={selectedCall.patient}
                      condition={selectedCall.condition}
                      aiFields={selectedCall.aiFields}
                      nehrStatus={selectedCall.nehrStatus}
                      nehrData={selectedCall.nehrData}
                      allergies={selectedCall.allergies}
                      past_conditions={selectedCall.past_conditions}
                      additional_notes={selectedCall.additional_notes}
                      onFieldEdit={(field, value) => {
                        sendMessage('field_edit', { call_id: selectedCallId, field, value })
                        setCalls(prev => {
                          const call = prev.get(selectedCallId)
                          if (!call) return prev
                          const next = new Map(prev)
                          if (['name', 'age', 'location'].includes(field)) {
                            next.set(selectedCallId, { ...call, patient: { ...call.patient, [field]: value } })
                          } else if (field === 'allergies' || field === 'past_conditions') {
                            // Store as comma-split list
                            next.set(selectedCallId, { ...call, [field]: value.split(',').map(s => s.trim()).filter(Boolean) })
                          } else {
                            next.set(selectedCallId, { ...call, [field]: value })
                          }
                          return next
                        })
                      }}
                    />
                  </div>
                  <div style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', borderLeft: '1px solid #1e293b', overflowY: 'auto' }}>
                    <TriagePanel
                      pacs={selectedCall.pacs}
                      differentials={selectedCall.differentials}
                      confirmed={selectedCall.confirmed}
                      onConfirm={() => sendMessage('confirm_triage', { call_id: selectedCallId })}
                      onTransferNonEmergency={() => sendMessage('end_call', { call_id: selectedCallId })}
                      onPacsEdit={(pacs) => {
                        sendMessage('field_edit', { call_id: selectedCallId, field: 'pacs', value: pacs })
                        setCalls(prev => {
                          const call = prev.get(selectedCallId)
                          if (!call) return prev
                          const next = new Map(prev)
                          next.set(selectedCallId, { ...call, pacs })
                          return next
                        })
                      }}
                    />
                    <SmartHoldButton
                      callId={selectedCallId}
                      status={selectedCall.status}
                      onSmartHold={() => sendMessage('set_smart_hold', { call_id: selectedCallId })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                Select a call from the queue
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
