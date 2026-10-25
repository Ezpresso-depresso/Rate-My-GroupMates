import './Awards.css';

export function AwardsHero({ teamName, count }: { teamName: string; count: number }) {
  return (
    <section className="awards-hero">
      <div className="hero-orbit orbit-one" />
      <div className="hero-orbit orbit-two" />
      <div className="eyebrow">{teamName} · Props, roasts &amp; project receipts</div>
      <h1 id='awardHeroMaintext'>
        how do you sleep at night
        <br />
        <span id='awardHeroSubtext'>knowing that you ruined someone's profile</span>
      </h1>
      <p>You will answer to god for your reviews one day</p>
      <span className="ceremony-pill">✦ All {count} reviews submitted · Awards calculated automatically</span>
      <span className="hero-spark spark-one">✧</span>
      <span className="hero-spark spark-two">✦</span>
    </section>
  );
}
