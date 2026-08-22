/**
 * The product's signature structural device: a thin rail of dots
 * showing position within a sequence. This directly reflects the
 * backend architecture (device trust states, agent run states, and
 * workflow states are all explicit, ordered state machines) rather
 * than decorating arbitrary content.
 */
export function StateRail({ states, current }: { states: string[]; current: string }) {
  const currentIndex = states.indexOf(current);
  return (
    <div className="state-rail" title={states.join(" -> ")}>
      {states.map((s, i) => (
        <span
          key={s}
          className="state-rail-dot"
          data-passed={i < currentIndex}
          data-current={i === currentIndex}
        />
      ))}
    </div>
  );
}
