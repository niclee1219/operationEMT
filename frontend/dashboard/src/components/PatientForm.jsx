import { useState } from 'react'

const FIELDS = [
  { key: 'name',      label: 'Name' },
  { key: 'age',       label: 'Age' },
  { key: 'location',  label: 'Location' },
  { key: 'condition', label: 'Condition' },
]

function FieldInput({ fieldKey, label, value, isAI, onChange }) {
  return (
    <>
      <style>{`
        @keyframes aiFlash {
          0%   { background: #fbbf24; }
          50%  { background: rgba(251,191,36,0.15); }
          100% { background: transparent; }
        }
        .ai-flash-input {
          animation: aiFlash 2s ease-out forwards;
        }
      `}</style>
      <div style={{ position: 'relative' }}>
        <label style={{
          display: 'block',
          fontSize: '11px',
          fontWeight: 600,
          color: '#64748b',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}>
          {label}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            key={isAI ? `${fieldKey}-ai` : fieldKey}
            className={isAI ? 'ai-flash-input' : ''}
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '5px',
              padding: '7px 10px',
              color: '#e2e8f0',
              fontSize: '14px',
              fontFamily: 'system-ui, sans-serif',
              outline: 'none',
              paddingRight: isAI ? '40px' : '10px',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#3b82f6' }}
            onBlur={(e) => { e.target.style.borderColor = '#334155' }}
          />
          {isAI && (
            <span style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#fbbf24',
              color: '#0f172a',
              fontSize: '10px',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '3px',
              letterSpacing: '0.05em',
              pointerEvents: 'none',
            }}>
              AI
            </span>
          )}
        </div>
      </div>
    </>
  )
}

export default function PatientForm({ patient = {}, condition = '', aiFields = new Set(), onFieldEdit }) {
  const [localAiFields, setLocalAiFields] = useState(new Set(aiFields))

  const values = {
    name: patient.name ?? '',
    age: patient.age != null ? String(patient.age) : '',
    location: patient.location ?? '',
    condition: condition ?? '',
  }

  function handleChange(field, value) {
    setLocalAiFields((prev) => {
      const next = new Set(prev)
      next.delete(field)
      return next
    })
    if (onFieldEdit) onFieldEdit(field, value)
  }

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '8px',
      padding: '16px',
    }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#64748b',
        marginBottom: '14px',
        fontVariant: 'small-caps',
      }}>
        Patient Details
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {FIELDS.map(({ key, label }) => (
          <FieldInput
            key={key}
            fieldKey={key}
            label={label}
            value={values[key]}
            isAI={localAiFields.has(key)}
            onChange={handleChange}
          />
        ))}
      </div>
    </div>
  )
}
