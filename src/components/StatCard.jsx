export default function StatCard({ label, value, detail, icon: Icon, tone = "teal" }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-icon">{Icon ? <Icon size={18} /> : null}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </article>
  );
}
