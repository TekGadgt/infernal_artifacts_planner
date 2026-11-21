import { useState } from 'react';
import { BUILDS, ITEM_SOURCES, buildIssues, buildLoadout, pieceItem, powerSource, slotLabel, type Build, type BuildPiece } from '../data/builds';
import { itemById } from '../data/game';
import { affixById, powerById, rarityById } from '../data/league';
import { usePlan } from '../lib/plan';
import { ROMAN, TIER_STATUS_TEXT, fmt, loadoutTotals, tierStatus } from '../lib/rules';
import './BuildGuide.css';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

const SOURCE_LABEL = { community: 'Community build', theory: 'Theory, not tested' };
const POWER_HOW = {
  rolls: 'Rolls on this item',
  stamp: 'Stamp it on, if the Codex allows',
  boss: 'Boss power: never rolls on items',
};

function readBuild(): string {
  const id = new URLSearchParams(window.location.search).get('build');
  return BUILDS.some((b) => b.id === id) ? id! : BUILDS[0].id;
}

function PieceRow({ piece, build }: { piece: BuildPiece; build: Build }) {
  const game = itemById.get(piece.item)!;
  const planned = pieceItem(piece, build.variant);
  const rarity = rarityById.get(planned.rarity)!;
  const free = rarity.affixes[1] - piece.affixes.length;
  const power = piece.power ? powerById.get(piece.power) : null;
  const how = powerSource(piece);
  // Requirements and other notes that aren't about tiers or free slots.
  const notes = buildIssues({ ...build, pieces: [piece] })
    .map((i) => i.issue.text)
    .filter((t) => !/rolls from item level|fewer than a drop gives/.test(t));

  return (
    <tr>
      <th scope="row">{slotLabel(piece.slot)}</th>
      <td>
        <a className="build-item" href={`${base}/items/?item=${game.id}`} style={{ color: rarity.color }}>
          {game.name}
        </a>
        <span className="build-item__meta muted">
          {' '}
          ilvl {planned.ilvl}
          {piece.ilvl && piece.ilvl > game.ilvl && ` (base ${game.ilvl})`}
          {planned.rarity !== game.rarity && `, ${rarityById.get(game.rarity)!.label} at base`}
        </span>
        <span className="build-item__source muted">{ITEM_SOURCES[piece.item]}</span>
      </td>
      <td>
        <ul className="build-affixes">
          {piece.affixes.map(([id, tier], i) => {
            const affix = affixById.get(id)!;
            const status = tierStatus(affix, affix.tiers.find((t) => t.tier === tier)!, planned);
            return (
              <li key={i} className={`build-affix build-affix--${affix.category}`}>
                {affix.name} <span className="num">{ROMAN[tier]}</span>
                {status === 'improve' && (
                  <span className="build-affix__improve" title={TIER_STATUS_TEXT.improve}>
                    {' '}
                    ↑
                  </span>
                )}
              </li>
            );
          })}
          {free > 0 && (
            <li className="build-affix build-affix--free">
              {free} free slot{free === 1 ? '' : 's'}
            </li>
          )}
        </ul>
        {notes.map((n) => (
          <p key={n} className="build-note build-note--warn">
            {n}
          </p>
        ))}
        {piece.note && <p className="build-note">{piece.note}</p>}
      </td>
      <td>
        {power ? (
          <>
            <span className="build-power">{power.name}</span>
            <span className={`build-power__how build-power__how--${how}`}>{POWER_HOW[how!]}</span>
          </>
        ) : planned.rarity === 'legendary' ? (
          <span className="muted">Your choice</span>
        ) : (
          <span className="muted">None</span>
        )}
      </td>
    </tr>
  );
}

/** The build's summed affixes: capped stats against their caps, then uncapped ones. */
function Totals({ build }: { build: Build }) {
  const totals = loadoutTotals(buildLoadout(build, build.id).items).filter((t) => t.total !== null);
  // Juggernaut and Bulwark caps limit what the affix produces, not the summed affix, so they list as uncapped.
  const sumCapped = (t: (typeof totals)[number]) => t.cap.value !== null && !['juggernaut', 'bulwark'].includes(t.affix.id);
  const capped = totals.filter(sumCapped);
  const uncapped = totals.filter((t) => !sumCapped(t));
  return (
    <section className="build-totals" aria-label="Stat totals">
      <h4>Totals against caps</h4>
      <div className="table-wrap">
        <table className="table build-totals__table">
          <thead>
            <tr>
              <th>Affix</th>
              <th className="num">Total</th>
              <th className="num">Cap</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {capped.map((t) => {
              const gap = t.total! - t.cap.value!;
              return (
                <tr key={t.affix.id}>
                  <th scope="row">{t.affix.name}</th>
                  <td className="num">
                    {fmt(t.total)}
                    {t.unit}
                  </td>
                  <td className="num">{t.cap.text}</td>
                  <td className={gap > 0 ? 'build-totals__over' : 'muted'}>
                    {Math.abs(gap) < 0.05
                      ? 'At the cap'
                      : gap <= 0
                        ? `${fmt(-gap)} short`
                        : t.affix.id === 'precise'
                          ? `${fmt(gap)} over, unless Critty City turns it into crit damage`
                          : `${fmt(gap)} over: improve less`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {uncapped.length > 0 && (
        <p className="build-totals__uncapped">
          No cap on the total:{' '}
          {uncapped.map((t, i) => (
            <span key={t.affix.id}>
              {i > 0 && ', '}
              {t.affix.name} {fmt(t.total)}
              {t.unit}
            </span>
          ))}
        </p>
      )}
      <p className="muted build-totals__note">
        Each roll counted at the top of its tier, on {build.variant === 'ancient' ? 'Ancient' : 'normal'} gear, from affixes only: relics,
        powers and the items’ own stats aren’t included. Some caps also count other sources, so a stat short of its cap may still reach it.
      </p>
    </section>
  );
}

export default function BuildGuide() {
  const [selected, setSelected] = useState(readBuild);
  const [, setPlan] = usePlan();
  const [added, setAdded] = useState<string | null>(null);
  const build = BUILDS.find((b) => b.id === selected)!;

  const pick = (id: string) => {
    setSelected(id);
    setAdded(null);
    const url = new URL(window.location.href);
    url.searchParams.set('build', id);
    history.replaceState(null, '', url);
  };
  const addToPlan = () => {
    const loadout = buildLoadout(build);
    setPlan((p) => ({ ...p, loadouts: [...p.loadouts, loadout], activeLoadout: loadout.id }));
    setAdded(build.id);
  };

  return (
    <div className="builds">
      <div className="runs__tabs builds__tabs" role="tablist" aria-label="Builds">
        {BUILDS.map((b) => (
          <button key={b.id} type="button" role="tab" className="runs__tab" aria-selected={b.id === selected} onClick={() => pick(b.id)}>
            <span className="runs__tab-name">{b.name.split(':')[0]}</span>
            <span className="runs__tab-meta">{SOURCE_LABEL[b.source]}</span>
          </button>
        ))}
      </div>

      <article className="build panel" role="tabpanel" aria-label={build.name}>
        <header className="build__head">
          <div>
            <h3>{build.name}</h3>
            <span className={`tag build__source build__source--${build.source}`}>{SOURCE_LABEL[build.source]}</span>
            {build.author && <span className="build__author muted"> Shared by {build.author}</span>}
          </div>
          <div className="build__add">
            <button className="btn btn--hot" onClick={addToPlan}>
              Add to my gear plan
            </button>
            {added === build.id && (
              <span className="build__added" role="status">
                Added as a new loadout. <a href={`${base}/gear/`}>Open the Gear page</a>
              </span>
            )}
          </div>
        </header>
        <p className="build__summary">{build.summary}</p>

        <div className="table-wrap">
          <table className="table build-table">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Item</th>
                <th>Affixes</th>
                <th>Demonic Power</th>
              </tr>
            </thead>
            <tbody>
              {build.pieces.map((p) => (
                <PieceRow key={p.slot} piece={p} build={build} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted build__legend">
          Every item is planned as {build.variant === 'ancient' ? 'Ancient (Ancient Awakening)' : 'shown'}. ↑ marks a tier the item can only reach
          with Improve, not by rolling it.
        </p>

        <Totals build={build} />

        <ul className="build__notes">
          {build.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}
