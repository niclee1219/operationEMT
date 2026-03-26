import { useState, useCallback, useRef, useEffect } from 'react'
import useWebSocket from './hooks/useWebSocket'
import CallQueue from './components/CallQueue'
import LiveTranscript from './components/LiveTranscript'
import PatientForm from './components/PatientForm'
import TriagePanel from './components/TriagePanel'
import EscalationAlert from './components/EscalationAlert'
import SmartHoldButton from './components/SmartHoldButton'

function makeEmptyCall(call_id) {
  return {
    call_id,
    status: 'active',
    transcript: '',
    patient: { name: null, age: null, location: null },
    condition: null,
    differentials: [],
    pacs: null,
    confirmed: false,
    aiFields: new Set(),
  }
}

export default function App() {
  const [calls, setCalls] = useState(new Map())
  const [selectedCallId, setSelectedCallId] = useState(null)
  const [activeAlert, setActiveAlert] = useState(null)
  const aiFieldTimers = useRef({})  // call_id+field → timeout id

  useEffect(() => {
    return () => {
      Object.values(aiFieldTimers.current).forEach(clearTimeout)
    }
  }, [])

  const handleMessage = useCallback((msg) => {
    const { type, call_id } = msg

    if (type === 'call_started') {
      setCalls(prev => {
        const next = new Map(prev)
        if (!next.has(call_id)) {
          next.set(call_id, makeEmptyCall(call_id))
        }
        return next
      })
      setSelectedCallId(id => id ?? call_id)

    } else if (type === 'transcript_delta') {
      setCalls(prev => {
        const call = prev.get(call_id)
        if (!call) return prev
        const next = new Map(prev)
        next.set(call_id, { ...call, transcript: call.transcript + ' ' + msg.text })
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

        next.set(call_id, {
          ...call,
          patient: msg.patient ?? call.patient,
          condition: msg.condition ?? call.condition,
          differentials: msg.differentials ?? call.differentials,
          pacs: msg.pacs ?? call.pacs,
          confirmed: msg.confirmed ?? call.confirmed,
          aiFields: newAiFields,
        })

        // Clear AI flash after 3 seconds for each updated field
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
        const next = new Map(prev)
        next.delete(call_id)
        return next
      })
      setSelectedCallId(id => id === call_id ? null : id)
    }
  }, [])

  const { sendMessage } = useWebSocket(handleMessage)

  const selectedCall = calls.get(selectedCallId)
  const callsArray = Array.from(calls.values())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <EscalationAlert
        alert={activeAlert}
        onResumeCall={(id) => {
          sendMessage('resume_call', { call_id: id })
          setActiveAlert(null)
        }}
      />
      {callsArray.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📡</div>
            <div style={{ fontSize: '18px' }}>Waiting for incoming calls...</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>Connect a caller to begin</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <CallQueue
            calls={callsArray}
            selectedCallId={selectedCallId}
            onSelect={setSelectedCallId}
          />
          {selectedCall ? (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflow: 'auto' }}>
                <LiveTranscript transcript={selectedCall.transcript} />
                <PatientForm
                  patient={selectedCall.patient}
                  condition={selectedCall.condition}
                  aiFields={selectedCall.aiFields}
                  onFieldEdit={(field, value) => {
                    sendMessage('field_edit', { call_id: selectedCallId, field, value })
                  }}
                />
              </div>
              <div style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', borderLeft: '1px solid #1e293b' }}>
                <TriagePanel
                  pacs={selectedCall.pacs}
                  differentials={selectedCall.differentials}
                  confirmed={selectedCall.confirmed}
                  onConfirm={() => sendMessage('confirm_triage', { call_id: selectedCallId })}
                  onPacsEdit={(pacs) => sendMessage('field_edit', { call_id: selectedCallId, field: 'pacs', value: pacs })}
                />
                <SmartHoldButton
                  callId={selectedCallId}
                  status={selectedCall.status}
                  onSmartHold={() => sendMessage('set_smart_hold', { call_id: selectedCallId })}
                />
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              Select a call from the queue
            </div>
          )}
        </div>
      )}
    </div>
  )
}
