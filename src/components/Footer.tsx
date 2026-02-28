/**
 * Footer — Reusable site-wide footer with author credit.
 * Hidden on mobile (bottom nav replaces it), visible on md+ screens.
 */

export default function Footer() {
    return (
        <footer className="hidden md:block w-full py-4 px-4 text-center border-t border-white/[0.06] bg-zayko-900/80">
            <p className="text-xs text-zayko-500 font-semibold mb-1">⚡ Powered by Zayko</p>
            <p className="text-xs text-zayko-500 leading-relaxed">
                Made with <span className="text-red-400">❤️</span> by{" "}
                <span className="font-semibold text-zayko-400">Shudhanshu Pandey</span>
            </p>
            <p className="text-[10px] text-zayko-600 mt-0.5">
                MCA 2nd Sem &nbsp;|&nbsp; Roll No: 25mca045
            </p>
        </footer>
    );
}
