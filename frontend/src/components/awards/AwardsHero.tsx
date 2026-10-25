import './Awards.css';

export function AwardsHero({ teamName, count }: { teamName: string; count: number }) {
  return (
    <section className="awards-hero">
      <div className="hero-orbit orbit-one" />
      <div className="hero-orbit orbit-two" />
      <div className="eyebrow">{teamName} · Props, roasts &amp; project receipts</div>
      <h1>
        The very unofficial
        <br />
        <span>groupmate awards.</span>
      </h1>
      <p>The carries, the ghosts, and everyone who said “looks good guys.”</p>
      <span className="ceremony-pill">✦ All {count} reviews submitted · Awards calculated automatically</span>
      <span className="hero-spark spark-one">✧</span>
      <span className="hero-spark spark-two">✦</span>
    </section>
  );
}
