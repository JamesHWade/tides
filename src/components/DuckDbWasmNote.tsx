export function DuckDbWasmNote() {
  return (
    <section className="card note-card" aria-labelledby="duckdb-heading">
      <div className="card-head">
        <h2 id="duckdb-heading">Why no DuckDB-WASM (yet)</h2>
      </div>
      <p>
        This app uses a small static TypeScript array for one week of tides at
        a single station. DuckDB-WASM would add a multi-megabyte engine to load
        a few dozen rows — the wrong trade.
      </p>
      <p>
        DuckDB-WASM becomes interesting if this grows into a beach-history
        planner: multiple years of tide predictions, weather, wildlife logs,
        family journal entries, and exportable trip reports. At that point an
        in-browser analytical engine pays for itself.
      </p>
    </section>
  );
}
