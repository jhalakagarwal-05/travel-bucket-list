import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart as ChartInstance } from 'chart.js';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
} from 'chart.js';
import type { DashboardData } from '../../shared/dashboard';
import './dashboard.css';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

type DashboardProps = { onUnauthorized: () => void };

const chartColors = ['#0f766e', '#d0a65d', '#819b90', '#c98168', '#9a8eaa', '#6d8991'];

export default function Dashboard({ onUnauthorized }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartInstance<'bar'> | null>(null);
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;
  const categories = useMemo(() => data?.categories ?? [], [data]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch('/api/dashboard', {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          unauthorizedRef.current();
          return null;
        }
        if (!response.ok) throw new Error('Dashboard request failed');
        return response.json() as Promise<DashboardData>;
      })
      .then((payload) => {
        if (payload && !controller.signal.aborted) setData(payload);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (loading || error || !canvasRef.current || categories.length === 0) return;
    const chart = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: categories.map((category) => category.categoryId === null ? 'Uncategorized' : category.name),
        datasets: [{
          label: 'Destinations',
          data: categories.map((category) => category.count),
          backgroundColor: categories.map((_, index) => chartColors[index % chartColors.length]),
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 54,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              label: (context) => ` ${context.parsed.y} ${context.parsed.y === 1 ? 'destination' : 'destinations'}`,
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#687780', font: { family: 'DM Sans', size: 12 } },
          },
          y: {
            type: 'linear',
            beginAtZero: true,
            title: { display: true, text: 'Destinations', color: '#687780' },
            suggestedMax: Math.max(1, ...categories.map((category) => category.count)),
            ticks: {
              stepSize: 1,
              precision: 0,
              color: '#87928f',
              font: { family: 'DM Sans', size: 11 },
              padding: 9,
            },
            grid: { color: '#edf0eb' },
            border: { display: false, dash: [3, 4] },
          },
        },
      },
    });
    chartRef.current = chart;
    return () => {
      chart.destroy();
      if (chartRef.current === chart) chartRef.current = null;
    };
  }, [categories, loading, error]);

  if (loading) {
    return (
      <main className="dashboard-main" aria-label="Loading your dashboard" aria-busy="true">
        <div className="dashboard-skeleton-heading" />
        <div className="dashboard-skeleton-stats"><i /><i /><i /></div>
        <div className="dashboard-skeleton-chart" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard-main">
        <div className="dashboard-error" role="alert">
          <span className="dashboard-kicker">A small detour</span>
          <h1>Your travel notes are taking a moment.</h1>
          <p>We couldn’t load your dashboard just now. Your saved destinations are safe; try again in a moment.</p>
          <button type="button" className="dashboard-retry" onClick={() => setAttempt((current) => current + 1)}>Try again</button>
        </div>
      </main>
    );
  }

  const total = data?.totalDestinations ?? 0;
  const visited = data?.visitedCount ?? 0;
  const averagePriority = (total === 0 ? 0 : data?.averagePriority ?? 0).toFixed(1);

  return (
    <main className="dashboard-main">
      <header className="dashboard-heading">
        <div>
          <span className="dashboard-kicker">Your travel journal</span>
          <h1>Journeys, at a glance.</h1>
          <p>A little record of where you’ve been, and what’s calling next.</p>
        </div>
        <div className="dashboard-heading-mark" aria-hidden="true">
          <svg viewBox="0 0 72 72" fill="none">
            <circle cx="36" cy="36" r="29" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 5" />
            <path d="M17 48.5 30 23l8.2 16.1 6-9.2L56 48.5M13 53h46" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="30" cy="23" r="3" fill="#d0a65d" />
          </svg>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="Your destination statistics">
        <article className="dashboard-stat stat-total">
          <span className="stat-label">Total destinations</span>
          <strong>{total}</strong>
          <span className="stat-caption">Places on your list</span>
          <span className="stat-decoration" aria-hidden="true">01</span>
        </article>
        <article className="dashboard-stat stat-visited">
          <span className="stat-label">Visited</span>
          <strong>{visited}</strong>
          <span className="stat-caption">Places you’ve made memories</span>
          <span className="stat-decoration" aria-hidden="true">02</span>
        </article>
        <article className="dashboard-stat stat-priority">
          <span className="stat-label">Average priority</span>
          <strong>{averagePriority}<small> / 5</small></strong>
          <span className="stat-caption">Your current sense of “next”</span>
          <span className="stat-decoration" aria-hidden="true">03</span>
        </article>
      </section>

      {total === 0 ? (
        <section className="dashboard-empty" aria-labelledby="dashboard-empty-title">
          <div className="empty-compass" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="23" stroke="currentColor" strokeWidth="1.4" /><path d="m40.5 23.5-5.7 13-12.3 4 5.7-13 12.3-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="32" cy="32" r="2" fill="#d0a65d" /></svg>
          </div>
          <span className="dashboard-kicker">The map is yours to fill</span>
          <h2 id="dashboard-empty-title">Every great trip starts somewhere.</h2>
          <p>Add a destination to your list and your travel story will begin to take shape here.</p>
        </section>
      ) : (
        <section className="category-panel" aria-labelledby="category-heading">
          <div className="category-panel-top">
            <div>
              <span className="dashboard-kicker">Your collection</span>
              <h2 id="category-heading">Destinations by category</h2>
            </div>
            <span className="category-total">{categories.length} {categories.length === 1 ? 'category' : 'categories'}</span>
          </div>
          {categories.length > 0 ? (
            <div className="category-content">
              <div className="category-chart" aria-label="Bar chart showing your destination count in each category">
                <canvas ref={canvasRef} role="img" aria-label="Destinations by category bar chart. Exact category counts are listed in the table next to the chart." />
              </div>
              <div className="category-table-wrap">
                <table className="category-table">
                  <caption>Exact destinations in each category</caption>
                  <thead><tr><th scope="col">Category</th><th scope="col">Places</th></tr></thead>
                  <tbody>
                    {categories.map((category, index) => (
                      <tr key={category.categoryId ?? 'uncategorized'}>
                        <th scope="row"><span className="category-dot" style={{ backgroundColor: chartColors[index % chartColors.length] }} />{category.categoryId === null ? 'Uncategorized' : category.name}</th>
                        <td>{category.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="no-category-data">There are destinations on your list, but no category counts to chart yet.</p>
          )}
          <p className="chart-footnote"><span aria-hidden="true" />A snapshot of your personal list</p>
        </section>
      )}
    </main>
  );
}
