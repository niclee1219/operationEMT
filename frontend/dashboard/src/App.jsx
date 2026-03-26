import CallQueue from './components/CallQueue'
import LiveTranscript from './components/LiveTranscript'
import PatientForm from './components/PatientForm'
import TriagePanel from './components/TriagePanel'
import EscalationAlert from './components/EscalationAlert'
import SmartHoldButton from './components/SmartHoldButton'

// Hardcoded demo data for visual testing
const DEMO_CALL = {
  call_id: 'demo-001',
  status: 'active',
  pacs: 'P1',
  confirmed: false,
  transcript: 'Hello 995, my husband collapsed. He has chest pain and is having trouble breathing. We are at Blk 44 Toa Payoh Lor 6, unit 08-12. He is 52 years old, his name is Ahmad.',
  patient: { name: 'Ahmad', age: 52, location: 'Blk 44 Toa Payoh Lor 6 #08-12' },
  condition: 'Acute chest pain with dyspnea',
  differentials: [
    { condition: 'STEMI', probability: 0.65 },
    { condition: 'NSTEMI', probability: 0.25 },
    { condition: 'Pulmonary Embolism', probability: 0.10 },
  ],
}

const DEMO_CALLS = [
  DEMO_CALL,
  { call_id: 'demo-002', status: 'smart_hold', pacs: 'P2', confirmed: true },
]

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <EscalationAlert
        alert={{ call_id: 'demo-002', trigger_phrase: 'stopped breathing', severity: 'critical' }}
        onResumeCall={(id) => console.log('resume', id)}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <CallQueue
          calls={DEMO_CALLS}
          selectedCallId="demo-001"
          onSelect={(id) => console.log('select', id)}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflow: 'auto' }}>
          <LiveTranscript transcript={DEMO_CALL.transcript} />
          <PatientForm
            patient={DEMO_CALL.patient}
            condition={DEMO_CALL.condition}
            aiFields={new Set(['name', 'location'])}
            onFieldEdit={(field, value) => console.log('edit', field, value)}
          />
        </div>
        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', borderLeft: '1px solid #1e293b' }}>
          <TriagePanel
            pacs={DEMO_CALL.pacs}
            differentials={DEMO_CALL.differentials}
            confirmed={DEMO_CALL.confirmed}
            onConfirm={() => console.log('confirm')}
            onPacsEdit={(p) => console.log('pacs edit', p)}
          />
          <SmartHoldButton
            callId="demo-001"
            status="active"
            onSmartHold={() => console.log('smart hold')}
          />
        </div>
      </div>
    </div>
  )
}
