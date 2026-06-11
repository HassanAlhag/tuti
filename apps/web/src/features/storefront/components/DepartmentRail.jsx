import { ChevronRight, Sparkles } from "lucide-react";

export function DepartmentRail({ activeFamily, families, products, setFamily }) {
  return (
    <section className="department-grid" aria-label="Departments">
      {families.filter((item) => item !== "All").map((department) => {
        const count = products.filter((product) => product.family === department).length;
        return (
          <button
            key={department}
            className={activeFamily === department ? "department-card active" : "department-card"}
            onClick={() => setFamily(department)}
            type="button"
          >
            <span><Sparkles size={17} /></span>
            <strong>{department}</strong>
            <small>{count || "More"} perfumes</small>
            <ChevronRight size={16} />
          </button>
        );
      })}
    </section>
  );
}
