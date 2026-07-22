export default function LogPanel({ lines }) {
  return (
    <div className="log-panel" id="log-panel">
      {lines.map((line, i) => (
        <div key={i} className={`line-${line.type}`}>
          [{line.time}] {line.text}
        </div>
      ))}
    </div>
  )
}
