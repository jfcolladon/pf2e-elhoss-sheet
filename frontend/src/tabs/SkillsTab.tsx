import { UpdateFn } from "../pages/Sheet";
import { Section, Teml } from "../components/common";
import { abilityMod, fmt, loreTotal, profBonus, skillTotal } from "../lib/calc";
import { versatilePerformanceSkills } from "../lib/rules";
import { Character, SKILLS } from "../types";

export default function SkillsTab({ c, update }: { c: Character; update: UpdateFn }) {
  const vpSkills = versatilePerformanceSkills(c);
  return (
    <Section title="Skills (cálculo automático: característica + proficiency + ítem − ACP)">
      <table className="sheet">
        <thead>
          <tr>
            <th>Skill</th><th>Total</th><th>Característica</th><th>Proficiency</th><th>Prof.</th><th>Ítem</th>
          </tr>
        </thead>
        <tbody>
          {SKILLS.map((s) => {
            const st = c.skills[s.key] ?? { rank: 0, item: 0 };
            const usesPerf = vpSkills.includes(s.key) && (c.skills.performance?.rank ?? 0) > st.rank;
            return (
              <tr key={s.key}>
                <td>
                  <b>{s.label}</b>{" "}
                  <span className="muted">({usesPerf ? "CHA via Performance" : s.ability.toUpperCase()})</span>
                  {usesPerf && <span className="badge comp" title="Versatile Performance">VP</span>}
                </td>
                <td><span className="total-badge">{fmt(skillTotal(c, s.key))}</span></td>
                <td>{fmt(abilityMod(c, s.ability))}</td>
                <td>
                  <Teml
                    value={st.rank}
                    onChange={(r) => update((o) => ({ ...o, skills: { ...o.skills, [s.key]: { ...st, rank: r } } }))}
                  />
                </td>
                <td>{profBonus(st.rank, c.level)}</td>
                <td>
                  <input type="number" style={{ width: 52 }} value={st.item}
                    onChange={(e) => update((o) => ({ ...o, skills: { ...o.skills, [s.key]: { ...st, item: +e.target.value } } }))} />
                </td>
              </tr>
            );
          })}
          {c.lores.map((l, i) => (
            <tr key={`lore-${i}`}>
              <td>
                <b>Lore:</b>{" "}
                <input style={{ width: 130 }} value={l.name}
                  onChange={(e) => update((o) => {
                    const lores = [...o.lores];
                    lores[i] = { ...l, name: e.target.value };
                    return { ...o, lores };
                  })} />
                <span className="muted"> ({l.ability?.toUpperCase() ?? "INT"})</span>
                {l.note && <span className="muted" title={l.note}> ⓘ</span>}
              </td>
              <td><span className="total-badge">{fmt(loreTotal(c, i))}</span></td>
              <td>{fmt(abilityMod(c, "int"))}</td>
              <td>
                <Teml value={l.rank} onChange={(r) => update((o) => {
                  const lores = [...o.lores];
                  lores[i] = { ...l, rank: r };
                  return { ...o, lores };
                })} />
              </td>
              <td>{profBonus(l.rank, c.level)}</td>
              <td>
                <input type="number" style={{ width: 52 }} value={l.item}
                  onChange={(e) => update((o) => {
                    const lores = [...o.lores];
                    lores[i] = { ...l, item: +e.target.value };
                    return { ...o, lores };
                  })} />
                <button className="small ghost" style={{ marginLeft: 4 }}
                  onClick={() => update((o) => ({ ...o, lores: o.lores.filter((_, j) => j !== i) }))}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="small" style={{ marginTop: 8 }}
        onClick={() => update((o) => ({ ...o, lores: [...o.lores, { name: "", rank: 1, item: 0 }] }))}>
        + Añadir Lore
      </button>
      {c.armor.checkPenalty !== 0 && (
        <p className="muted">Se aplica penalización de armadura ({c.armor.checkPenalty}) a skills de FUE y DES.</p>
      )}
    </Section>
  );
}
