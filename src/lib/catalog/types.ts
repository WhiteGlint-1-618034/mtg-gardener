export type SigCard = {
  id: string;
  n: string;
  t: string;
  o: string;
  ci: string[];
  cmc: number;
  mc: string;
  kw: string[];
  pw: string | null;
  tu: string | null;
  leg: "legal" | "banned";
  rel: string | null;
  prod: string[];
  p: string[];
  c: string[];
  i: string[];
  r: string[];
  ty: string[];
};

export type Line = {
  cards: string[];
  produces: string[];
  commander?: string;
};

export type Catalog = {
  cards: SigCard[];
  byName: Map<string, SigCard>;
  rulings: Map<string, string[]>;
  lines: Line[];
};
