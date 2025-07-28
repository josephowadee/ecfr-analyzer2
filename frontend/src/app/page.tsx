'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line,
} from 'recharts';

type Metric = {
  wordCount: number;    // total words in the Title
  refDensity: number;   // number of cross-references per 1k words
  defFreq: number;      // number of defined terms per word (we’ll scale)
  checksum: string;     // SHA-256 fingerprint of the full text
};

// For the history chart:
type HistoryPoint = {
  versionDate: string;  // snapshot date
  wordCount: number;    // total word count at that date
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTitle = searchParams.get('title');

  // — React state hooks —
  const [agencies, setAgencies] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<Record<string, Metric>>({});
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(initialTitle);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState({
    agencies: false,
    metrics: false,
    history: false,
  });

  const pageSize = 10;

  // — Fetch the list of all agencies (Titles) —
  async function fetchAgencies() {
    setLoading(l => ({ ...l, agencies: true }));
    const res = await fetch('/api/agencies');
    const list: string[] = await res.json();
    setAgencies(list);
    setLoading(l => ({ ...l, agencies: false }));
  }

  // — Fetch the latest Metric record for each Title on the current page —
  async function fetchMetrics() {
    setLoading(l => ({ ...l, metrics: true }));
    const paged = filteredAgencies.slice((page - 1) * pageSize, page * pageSize);
    const pairs = await Promise.all(
      paged.map(async name => {
        const res = await fetch(`/api/agencies/${encodeURIComponent(name)}/metrics`);
        const m: Metric = await res.json();
        return [name, m] as const;
      })
    );
    setMetrics(prev => ({ ...prev, ...Object.fromEntries(pairs) }));
    setLoading(l => ({ ...l, metrics: false }));
  }

  // — Fetch historical word-count series for the selected Title —
  async function fetchHistory(name: string) {
    setLoading(l => ({ ...l, history: true }));
    const res = await fetch(`/api/agencies/${encodeURIComponent(name)}/history`);
    const h: HistoryPoint[] = await res.json();
    setHistory(prev => ({ ...prev, [name]: h }));
    setLoading(l => ({ ...l, history: false }));
  }

  // — Combined refresh: agencies + timestamp —
  async function refreshAll() {
    await fetchAgencies();
    setLastUpdated(new Date());
  }

  // — On mount: load agencies, then poll every 15s —
  useEffect(() => {
    refreshAll();
    const iv = setInterval(refreshAll, 15_000);
    return () => clearInterval(iv);
  }, []);

  // — Whenever the agency list or page or searchTerm changes, reload metrics —
  useEffect(() => {
    if (agencies.length) fetchMetrics();
  }, [agencies, page, searchTerm]);

  // — Whenever the user picks a Title, update the URL and load its history —
  useEffect(() => {
    if (selected) {
      router.replace(`/?title=${encodeURIComponent(selected)}`, { scroll: false });
      fetchHistory(selected);
    }
  }, [selected]);

  // — Filter & paginate the agency list —
  const filteredAgencies = agencies.filter(a =>
    a.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filteredAgencies.length / pageSize);
  const paged = filteredAgencies.slice((page - 1) * pageSize, page * pageSize);

  // — Prepare bar-chart data, scaling defFreq into defs per 1k words —
  const barData = paged.map(name => {
    const m = metrics[name] || { wordCount: 0, refDensity: 0, defFreq: 0, checksum: '' };
    return {
      agency: name,
      wordCount: m.wordCount,
      refDensity: m.refDensity,
      defFreqK: m.defFreq * 1000,   // convert to defs per 1k words
    };
  });

  return (
    <main className="p-8 space-y-8 bg-gray-50 min-h-screen">

      {/* — Header with auto-refresh info — */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-baseline gap-4">
        <h1 className="text-3xl font-bold">eCFR Agency Dashboard</h1>
        <div className="text-sm text-gray-600">
          {loading.agencies
            ? 'Loading agencies…'
            : <>Auto-refresh every 15 s · Last updated: {lastUpdated?.toLocaleTimeString()}</>
          }
        </div>
      </header>

{/* — Dashboard Info Panel — */}
<section className="bg-white p-6 rounded-lg shadow-lg space-y-4">
  <h2 className="text-2xl font-semibold">About this Dashboard</h2>
  <p className="text-gray-700">
    This dashboard surfaces **high-level metrics** for each Title of the eCFR so you can quickly
    gauge where the heaviest regulations lie, track changes over time, and verify data integrity.
  </p>
  <ul className="list-disc list-inside text-gray-700 space-y-1">
    <li>
      <strong>Total Word Count:</strong> The total number of words in that Title. Larger counts
      often indicate more complex or voluminous regulation.
    </li>
    <li>
      <strong>Cross-Reference Density:</strong> How many internal references (e.g. “see § 5.12”) occur
      per 1,000 words—an indicator of interdependency and complexity.
    </li>
    <li>
      <strong>Defined-Term Density:</strong> How many legally defined terms per 1,000 words—higher
      densities often mean more specialized, precise language.
    </li>
    <li>
      <strong>Checksum:</strong> A SHA-256 fingerprint of the full text, so you can detect if the
      regulations have changed since your last view.
    </li>
  </ul>
  <p className="text-sm text-gray-500">
    Use the search box or the pagination controls to find the Title you care about. Click any Title
    tile to drill into its historical word-count trend. Charts auto-refresh every 15 seconds.
  </p>
</section>

      {/* — Search bar with counts — */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="🔍 Search titles…"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
          className="flex-grow px-3 py-2 border rounded shadow-sm"
        />
        <span className="text-gray-500 text-sm">
          {filteredAgencies.length} of {agencies.length}
        </span>
      </div>

      {/* — Paginated, responsive grid of Title buttons — */}
      <section className="bg-white p-4 rounded shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Select a Title</h2>
        {loading.metrics ? (
          <div>Loading metrics…</div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
            {paged.map(name => (
              <li key={name}>
                <button
                  onClick={() => setSelected(name)}
                  className={`w-full text-left px-2 py-1 border rounded 
                    ${selected === name
                      ? 'bg-blue-200 border-blue-400'
                      : 'hover:bg-gray-100'}
                  `}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* Pagination controls */}
        <div className="flex justify-center items-center space-x-4 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </section>

      {/* — Dual-axis Bar Chart Section — */}
      <section className="p-4 rounded bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-1">
          Comparative Metrics
          <span title="Blue uses left axis; orange & green use right axis.">ℹ️</span>
        </h2>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <BarChart
              data={barData}
              margin={{ top: 10, right: 50, left: 10, bottom: 60 }}
            >
              <XAxis dataKey="agency" angle={-45} textAnchor="end" height={60} />

              {/* Left axis: total words */}
              <YAxis
                yAxisId="left"
                label={{ value: 'Word Count', angle: -90, position: 'insideLeft' }}
              />
              {/* Right axis: densities */}
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Refs/1k & Defs/1k words', angle: -90, position: 'insideRight' }}
              />

              <Tooltip formatter={v => v.toLocaleString()} />
              <Legend verticalAlign="top" />

              <Bar yAxisId="left" dataKey="wordCount" name="Word Count" fill="#1f77b4" />
              <Bar yAxisId="right" dataKey="refDensity" name="Refs per 1k words" fill="#ff7f0e" />
              <Bar yAxisId="right" dataKey="defFreqK" name="Defs per 1k words" fill="#2ca02c" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* — Color-coded notes explaining each bar — */}
        <div className="mt-4 space-y-1 text-sm text-gray-600">
          <div>
            <span className="inline-block w-3 h-3 bg-[#1f77b4] mr-2 align-middle"></span>
            <strong>Blue:</strong> Total Word Count
          </div>
          <div>
            <span className="inline-block w-3 h-3 bg-[#ff7f0e] mr-2 align-middle"></span>
            <strong>Orange:</strong> Cross-refs per 1,000 words. The number of times this Title refers you elsewhere in the CFR. A high cross-ref density means the Title is highly interlinked. Understanding it often requires jumping around multiple other sections. Fewer cross-refs implies a more self-contained, standalone set of rules.
          </div>
          <div>
            <span className="inline-block w-3 h-3 bg-[#2ca02c] mr-2 align-middle"></span>
            <strong>Green:</strong> Defined terms per 1,000 words. The count of legally defined words (the ones that appear in all-caps or are explicitly “defined” in a definitions section). 
	Higher density indicates more technical or precise terminology. Each defined term often carries a narrow, legally binding definition. Lower density suggests more free-form narrative or fewer legal “shorthand” terms to keep track of.
          </div>
        </div>
      </section>

      {/* — Checksums table — */}
      <section className="p-4 rounded bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Checksums</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2">Agency</th>
                <th className="border px-4 py-2">Checksum</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(name => (
                <tr key={name} className="even:bg-gray-50">
                  <td className="border px-4 py-2">{name}</td>
                  <td className="border px-4 py-2 font-mono break-all">
                    {metrics[name]?.checksum ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* — Historical line chart for the selected Title — */}
      {selected && (
        <section className="p-4 rounded bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-2">
            Historical Word Count for {selected}
          </h2>
          {loading.history ? (
            <div>Loading history…</div>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={history[selected] || []}>
                  <XAxis
                    dataKey="versionDate"
                    tickFormatter={d => new Date(d).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip labelFormatter={d => new Date(d).toLocaleDateString()} />
                  <Line
                    type="monotone"
                    dataKey="wordCount"
                    stroke="#8884d8"
                    name="Word Count"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}
    {/* — Historical line chart for the selected Title — */}
      {selected && (
        <section className="p-4 rounded bg-white shadow-sm">
          {/* … your history chart … */}
        </section>
      )}

      {/* — Footer — */}
      <footer className="mt-12 py-6 border-t text-center text-sm text-gray-500">
        <div className="space-y-1">
          <div>© {new Date().getFullYear()} eCFR Analyzer</div>
          <div>
            Built by <a href="#" className="text-blue-600 hover:underline">Joseph Owadee</a>
          </div>
          <div>
            Data sourced from <a href="https://www.ecfr.gov" className="text-blue-600 hover:underline">eCFR.gov</a>
          </div>
        </div>
      </footer>
    </main>
  );
}