"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  BarController,
  BarElement,
  ArcElement,
  DoughnutController,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  BarController,
  BarElement,
  ArcElement,
  DoughnutController,
  Filler,
  Tooltip,
  Legend
);

const PALETTE = ["#e60012", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1"];

export function LineChart({
  labels,
  values,
  color = "#e60012",
  fillColor = "rgba(230,0,18,.12)",
  height = 120,
}: {
  labels: string[];
  values: number[];
  color?: string;
  fillColor?: string;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Messages", data: values, borderColor: color, backgroundColor: fillColor, fill: true, tension: 0.35 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
    return () => chart.destroy();
  }, [labels, values, color, fillColor]);
  return <canvas ref={ref} height={height} />;
}

export function BotBarChart({
  labels,
  values,
  height = 120,
}: {
  labels: string[];
  values: number[];
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Conversations",
            data: values,
            backgroundColor: ["#e60012", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6"],
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
    return () => chart.destroy();
  }, [labels, values]);
  return <canvas ref={ref} height={height} />;
}

export function DoughnutChart({
  labels,
  values,
  height = 200,
}: {
  labels: string[];
  values: number[];
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: PALETTE, borderWidth: 2, borderColor: "#fff" }],
      },
      options: {
        responsive: true,
        cutout: "62%",
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 14, font: { size: 12 } } } },
      },
    });
    return () => chart.destroy();
  }, [labels, values]);
  return <canvas ref={ref} height={height} />;
}

export function VBarChart({
  labels,
  values,
  label = "",
  color = "#e60012",
  height = 160,
  money = false,
}: {
  labels: string[];
  values: number[];
  label?: string;
  color?: string;
  height?: number;
  money?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: "bar",
      data: { labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 6, maxBarThickness: 46 }] },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: money ? { label: (c) => `$${c.parsed.y}` } : {} },
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
    return () => chart.destroy();
  }, [labels, values, label, color, money]);
  return <canvas ref={ref} height={height} />;
}
