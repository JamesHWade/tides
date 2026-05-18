export function StrandFeedingPanel() {
  return (
    <section className="card wildlife-card" aria-labelledby="strand-heading">
      <div className="card-head">
        <h2 id="strand-heading">🐬 Watching for strand feeding</h2>
        <p className="card-sub">
          Strand feeding is a rare cooperative-hunting behavior the Kiawah-River
          dolphins use against fish like mullet.
        </p>
      </div>

      <h3 className="wildlife-sub">When and where</h3>
      <ul className="wildlife-list">
        <li>
          <strong>Within roughly 2 hours of low tide</strong> the mud banks lining the
          Kiawah River are exposed enough for dolphins to push fish onto them. The
          per-day score in this app uses that window.
        </li>
        <li>
          Best viewing is from{" "}
          <strong>Captain Sams Inlet / Captain Sams Spit</strong> (about a one-mile
          walk southwest from Beachwalker Park along the beach), or from the
          north end of <strong>Seabrook Island</strong> facing the river mouth.
          You're watching the river bank, not the open surf.
        </li>
        <li>
          Activity peaks during the <strong>fall mullet outmigration (Sep–Nov)</strong>;
          May–August are still good, mid-winter is quietest.
        </li>
        <li>
          Larger tidal swings (spring tides at the new/full moon) expose more
          bank and are generally more productive.
        </li>
      </ul>

      <h3 className="wildlife-sub">Ethics &amp; the law</h3>
      <ul className="wildlife-list">
        <li>
          <strong>Stay back at least 15 yards (45 ft) from the waterline</strong>{" "}
          when dolphins are nearby. Closer can cause them to abandon a feed.
        </li>
        <li>
          From a boat, paddleboard, or kayak the federal viewing distance is{" "}
          <strong>50 yards (150 ft)</strong>. Never approach, follow, touch, or
          feed dolphins.
        </li>
        <li>
          Harassment is a federal offense under the Marine Mammal Protection
          Act — fines up to <strong>$100,000</strong> and up to one year in
          jail per violation.
        </li>
        <li>
          Keep kids quiet and above the wrack line, dogs leashed and back from
          the water, and follow signs and any{" "}
          <a
            href="https://www.lowcountrymarinemammalnetwork.org/"
            target="_blank"
            rel="noreferrer"
          >
            Lowcountry Marine Mammal Network
          </a>{" "}
          volunteers on site.
        </li>
      </ul>

      <p className="wildlife-footnote">
        Sources: Petricig 1995 (URI dissertation), Duffy-Echevarria et al. 2008
        (Marine Mammal Science), NOAA Fisheries, LMMN. Wind and rain inputs in
        the score are observer-comfort heuristics, not biology.
      </p>
    </section>
  );
}
