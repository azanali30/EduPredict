"""
EduPredict - Parallel Batch Processing Benchmark (Workstream B / Phase 14)
Module: scripts.benchmark_batch_processing
Purpose: Compares Sequential execution vs ThreadPoolExecutor vs ProcessPoolExecutor
on a deterministic read-only batch academic risk-scoring & statistical validation workload.
Designed with safe defaults for constrained 2-core / 8 GB hosts and never writes to
production MongoDB databases or overwrites ML model artifacts.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import asdict, dataclass
import json
import math
import os
from pathlib import Path
import platform
import time
import tracemalloc
from typing import Any, Dict, List


@dataclass
class BenchmarkModeResult:
    mode: str
    records_processed: int
    workers: int
    elapsed_seconds: float
    throughput_records_per_sec: float
    speedup_vs_sequential: float
    tracemalloc_peak_mb: float
    error_count: int


def _build_synthetic_batch(record_count: int) -> List[Dict[str, float]]:
    """Create deterministic read-only student evaluation payloads (no DB access, no PII)."""
    batch: List[Dict[str, float]] = []
    for idx in range(record_count):
        batch.append(
            {
                "record_idx": float(idx),
                "g1": float((idx % 18) + 2),
                "g2": float(((idx * 3) % 18) + 2),
                "absences": float(idx % 30),
                "study_hours": float((idx % 15) + 1),
                "failures": float(idx % 4),
            }
        )
    return batch


def _score_chunk(args: tuple[List[Dict[str, float]], int]) -> tuple[int, float]:
    """
    Top-level picklable worker function performing pure deterministic numeric
    risk normalization, weighted linear projection, and rolling variance checks.
    """
    chunk, workload_iters = args
    processed = 0
    checksum = 0.0
    for rec in chunk:
        g1 = rec["g1"]
        g2 = rec["g2"]
        abs_pct = max(0.0, 100.0 - (rec["absences"] / 60.0) * 100.0)
        study = rec["study_hours"]
        fail_pen = rec["failures"] * 1.25

        score = 0.0
        for step in range(workload_iters):
            weight = 1.0 + (step % 7) * 0.01
            score += (0.35 * g1 + 0.50 * g2 + 0.02 * abs_pct + 0.05 * study - fail_pen) * weight * 0.01
            score = math.fmod(score, 20.0)
        checksum += score
        processed += 1
    return processed, checksum


def _partition_chunks(items: List[Dict[str, float]], num_chunks: int) -> List[List[Dict[str, float]]]:
    chunk_count = max(1, min(num_chunks, len(items))) if items else 1
    chunks: List[List[Dict[str, float]]] = [[] for _ in range(chunk_count)]
    for i, item in enumerate(items):
        chunks[i % chunk_count].append(item)
    return [c for c in chunks if c]


def _run_mode(
    mode: str,
    batch: List[Dict[str, float]],
    workers: int,
    workload_iters: int,
) -> BenchmarkModeResult:
    tracemalloc.start()
    t0 = time.perf_counter()
    processed_total = 0
    error_count = 0

    try:
        if mode == "sequential":
            cnt, _ = _score_chunk((batch, workload_iters))
            processed_total += cnt
        elif mode == "thread":
            chunks = _partition_chunks(batch, workers)
            with ThreadPoolExecutor(max_workers=workers) as pool:
                for cnt, _ in pool.map(_score_chunk, [(c, workload_iters) for c in chunks]):
                    processed_total += cnt
        elif mode == "process":
            chunks = _partition_chunks(batch, workers)
            with ProcessPoolExecutor(max_workers=workers) as pool:
                for cnt, _ in pool.map(_score_chunk, [(c, workload_iters) for c in chunks]):
                    processed_total += cnt
        else:
            raise ValueError(f"Unsupported benchmark mode: {mode}")
    except Exception:
        error_count += 1

    elapsed = max(1e-6, time.perf_counter() - t0)
    _, peak_bytes = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    return BenchmarkModeResult(
        mode=mode,
        records_processed=processed_total,
        workers=1 if mode == "sequential" else workers,
        elapsed_seconds=round(elapsed, 4),
        throughput_records_per_sec=round(processed_total / elapsed, 2),
        speedup_vs_sequential=1.0,
        tracemalloc_peak_mb=round(peak_bytes / (1024 * 1024), 4),
        error_count=error_count,
    )


def run_benchmark(
    record_count: int = 200,
    workers: int = 2,
    workload_iters: int = 1200,
) -> Dict[str, Any]:
    """Run Sequential, ThreadPoolExecutor, and ProcessPoolExecutor batch benchmarks safely."""
    safe_records = max(1, min(10000, int(record_count)))
    safe_workers = max(1, min(4, int(workers)))
    safe_iters = max(10, min(20000, int(workload_iters)))

    batch = _build_synthetic_batch(safe_records)
    seq_res = _run_mode("sequential", batch, 1, safe_iters)
    thr_res = _run_mode("thread", batch, safe_workers, safe_iters)
    proc_res = _run_mode("process", batch, safe_workers, safe_iters)

    for res in (seq_res, thr_res, proc_res):
        res.speedup_vs_sequential = round(seq_res.elapsed_seconds / max(res.elapsed_seconds, 1e-6), 3)

    return {
        "benchmark": "edupredict_parallel_batch_processing",
        "environment": {
            "platform": platform.system(),
            "release": platform.release(),
            "python_version": platform.python_version(),
            "cpu_count": os.cpu_count() or 1,
        },
        "configuration": {
            "record_count": safe_records,
            "workers": safe_workers,
            "workload_iters_per_record": safe_iters,
            "mutates_production_db": False,
            "mutates_ml_artifacts": False,
        },
        "results": [asdict(seq_res), asdict(thr_res), asdict(proc_res)],
        "interpretation_notes": [
            "ThreadPoolExecutor runs inside one Python process and shares the GIL during pure-Python math.",
            "ProcessPoolExecutor bypasses the GIL across worker processes, but incurs Windows process spawn startup overhead that outweighs gains on very small batches.",
            "Parent tracemalloc measures parent heap allocations; spawned worker memory lives in child processes.",
        ],
    }


def _format_cli_table(report: Dict[str, Any]) -> str:
    lines = [
        "=== EduPredict Parallel Batch Processing Benchmark ===",
        f"Host: {report['environment']['platform']} | CPUs: {report['environment']['cpu_count']} | "
        f"Records: {report['configuration']['record_count']} | Workers: {report['configuration']['workers']}",
        "",
        f"{'Mode':<12} {'Workers':>7} {'Records':>8} {'Elapsed(s)':>11} {'Rec/s':>10} {'Speedup':>8} {'PeakMB':>8}",
        "-" * 72,
    ]
    for r in report["results"]:
        lines.append(
            f"{r['mode']:<12} {r['workers']:>7} {r['records_processed']:>8} "
            f"{r['elapsed_seconds']:>11.4f} {r['throughput_records_per_sec']:>10.2f} "
            f"{r['speedup_vs_sequential']:>7.3f}x {r['tracemalloc_peak_mb']:>8.4f}"
        )
    lines.append("")
    for note in report["interpretation_notes"]:
        lines.append(f"- {note}")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark sequential vs thread vs process batch scoring.")
    parser.add_argument("--records", type=int, default=200, help="Number of synthetic records (default: 200)")
    parser.add_argument("--workers", type=int, default=2, help="Pool worker count, clamped 1..4 (default: 2)")
    parser.add_argument("--iters", type=int, default=1200, help="Numeric iterations per record (default: 1200)")
    parser.add_argument("--json", action="store_true", help="Print JSON output instead of formatted CLI table")
    parser.add_argument("--output-json", type=str, default="", help="Optional path to save JSON metrics")
    args = parser.parse_args()

    report = run_benchmark(record_count=args.records, workers=args.workers, workload_iters=args.iters)
    if args.output_json:
        out_path = Path(args.output_json)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(_format_cli_table(report))


if __name__ == "__main__":
    main()
