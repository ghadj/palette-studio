/**
 * Balanced (spec 2.2, 2.5; M2 decision 5a): the approach behind Material Color Utilities. Wu
 * quantizes the weighted histogram to N colors, weighted k-means refines from those centroids in
 * one deterministic run (the iteration cap applies; seed and restarts don't, decision 5b), and
 * post-processing then ranks the result by the population and vividness score (decision 5c). Pure.
 */
import type { Histogram } from "./histogram";
import { kmeans } from "./kmeans";
import type { Cluster } from "./median-cut";
import { wu } from "./wu";

export interface BalancedOptions {
  k: number;
  /** K-means iterations, 5 to 100. */
  iterations?: number;
}

export function balanced(h: Histogram, { k, iterations = 25 }: BalancedOptions): Cluster[] {
  const seeds = wu(h, k);
  if (seeds.length === 0) return [];
  return kmeans(h, {
    k: seeds.length,
    iterations,
    initialCentroids: seeds.map((c) => c.color),
  }).clusters;
}
