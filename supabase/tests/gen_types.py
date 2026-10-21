"""Génère src/lib/database.types.ts depuis une base PostgreSQL locale (format Supabase).

Usage : python3 supabase/tests/gen_types.py "psql -d nabd_test" > src/lib/database.types.ts
En production, préférez : npx supabase gen types typescript --linked > src/lib/database.types.ts
"""
import json
import shlex
import subprocess
import sys

PSQL = shlex.split(sys.argv[1] if len(sys.argv) > 1 else "psql -d nabd_test")
HIDDEN_FUNCS = {"award_points", "do_checkin", "checkin_payload", "points_balance", "random_token"}


def q(sql: str):
    out = subprocess.run(PSQL + ["-At", "-c", f"select coalesce(json_agg(t), '[]') from ({sql}) t"],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


enums = q("""select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
             from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
             where n.nspname = 'public' group by t.typname order by t.typname""")
enum_names = {e["name"] for e in enums}

cols = q("""select c.table_name, c.column_name, c.udt_name, c.data_type, c.is_nullable = 'YES' as nullable,
                   c.column_default is not null as has_default, c.is_identity = 'YES' as identity,
                   c.is_generated = 'ALWAYS' as generated, t.table_type
            from information_schema.columns c
            join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
            where c.table_schema = 'public' order by c.table_name, c.ordinal_position""")

funcs = q("""select p.proname as name, p.proargnames as argnames,
                    array(select format_type(x, null) from unnest(p.proargtypes) x) as argtypes,
                    p.pronargdefaults as ndefaults, format_type(p.prorettype, null) as rettype
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and format_type(p.prorettype, null) <> 'trigger'
             order by p.proname""")


def ts_type(udt: str) -> str:
    if udt.startswith("_"):
        return f"{ts_type(udt[1:])}[]"
    base = udt.replace("public.", "")
    if base in enum_names:
        return f'Database["public"]["Enums"]["{base}"]'
    if base in ("int2", "int4", "int8", "integer", "bigint", "smallint", "numeric", "float4", "float8", "real",
                "double precision") or base.startswith("numeric"):
        return "number"
    if base in ("bool", "boolean"):
        return "boolean"
    if base in ("json", "jsonb"):
        return "Json"
    if base == "void":
        return "undefined"
    return "string"


tables: dict[str, list] = {}
views: dict[str, list] = {}
for c in cols:
    (views if c["table_type"] == "VIEW" else tables).setdefault(c["table_name"], []).append(c)

lines = [
    "// Fichier généré depuis le schéma SQL (supabase/migrations). Ne pas modifier à la main.",
    "// Régénérer : npm run db:types (projet Supabase lié) ou supabase/tests/gen_types.py (Postgres local).",
    "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];",
    "",
    "export type Database = {",
    '  __InternalSupabase: { PostgrestVersion: "13" };',
    "  public: {",
    "    Tables: {",
]
for name, cs in sorted(tables.items()):
    lines.append(f"      {name}: {{")
    lines.append("        Row: {")
    for c in cs:
        t = ts_type(c["udt_name"])
        lines.append(f"          {c['column_name']}: {t}{' | null' if c['nullable'] else ''};")
    lines.append("        };")
    for kind in ("Insert", "Update"):
        lines.append(f"        {kind}: {{")
        for c in cs:
            t = ts_type(c["udt_name"])
            if c["generated"]:
                lines.append(f"          {c['column_name']}?: never;")
                continue
            optional = kind == "Update" or c["nullable"] or c["has_default"] or c["identity"]
            lines.append(f"          {c['column_name']}{'?' if optional else ''}: {t}{' | null' if c['nullable'] else ''};")
        lines.append("        };")
    lines.append("        Relationships: [];")
    lines.append("      };")
lines += ["    };", "    Views: {"]
for name, cs in sorted(views.items()):
    lines.append(f"      {name}: {{")
    lines.append("        Row: {")
    for c in cs:
        lines.append(f"          {c['column_name']}: {ts_type(c['udt_name'])} | null;")
    lines.append("        };")
    lines.append("        Relationships: [];")
    lines.append("      };")
lines += ["    };", "    Functions: {"]
for f in funcs:
    if f["name"] in HIDDEN_FUNCS:
        continue
    names = f["argnames"] or []
    types = f["argtypes"] or []
    lines.append(f"      {f['name']}: {{")
    if not types:
        lines.append("        Args: never;")
    else:
        first_default = len(types) - (f["ndefaults"] or 0)
        args = []
        for i, (n, t) in enumerate(zip(names, types)):
            args.append(f"{n}{'?' if i >= first_default else ''}: {ts_type(t)}")
        lines.append("        Args: { " + "; ".join(args) + " };")
    lines.append(f"        Returns: {ts_type(f['rettype'])};")
    lines.append("      };")
lines += ["    };", "    Enums: {"]
for e in enums:
    lines.append(f"      {e['name']}: " + " | ".join(json.dumps(l, ensure_ascii=False) for l in e["labels"]) + ";")
lines += ["    };", "    CompositeTypes: { [_ in never]: never };", "  };", "};", ""]
lines += [
    'type PublicSchema = Database["public"];',
    'export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];',
    'export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];',
    'export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];',
    "",
]
print("\n".join(lines))
