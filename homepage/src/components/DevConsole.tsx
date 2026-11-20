interface DevConsoleProps {
  ciphertext: string
}

export default function DevConsole({ ciphertext }: DevConsoleProps) {
  return (
    <div
      style={{
        background: '#000',
        color: '#00ff00',
        fontFamily: 'monospace',
        fontSize: '11px',
        padding: '8px',
        marginTop: '4px',
        borderRadius: '4px'
      }}
    >
      RAW DATABASE STORAGE HEX: [{ciphertext}]
    </div>
  )
}
