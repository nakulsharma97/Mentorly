import { motion } from "framer-motion";

/**
 * RequestsSkeleton — shimmer skeleton that mirrors the request card layout
 * so the page never flashes a spinner while loading.
 */
export default function RequestsSkeleton({ count = 4 }) {
  return (
    <div className="lqr-skeleton" aria-busy="true" aria-label="Loading your requests">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="lqr-skeleton__card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.06 }}
        >
          <span className="lqr-skel lqr-skel--avatar" />
          <div className="flex-1 space-y-3" style={{ minWidth: 0 }}>
            <span className="lqr-skel lqr-skel--line" style={{ width: "42%", height: 18 }} />
            <span className="lqr-skel lqr-skel--line" style={{ width: "28%" }} />
            <span className="lqr-skel lqr-skel--line" style={{ width: "58%" }} />
          </div>
          <div className="hidden md:block" style={{ width: 180 }}>
            <span className="lqr-skel lqr-skel--line" style={{ width: "70%" }} />
            <span className="lqr-skel lqr-skel--line" style={{ width: "55%", marginTop: 8 }} />
          </div>
          <div className="hidden sm:flex flex-col gap-2" style={{ width: 150 }}>
            <span className="lqr-skel" style={{ height: 44, borderRadius: 12 }} />
            <span className="lqr-skel" style={{ height: 44, borderRadius: 12 }} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
