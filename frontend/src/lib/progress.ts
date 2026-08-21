import { api } from "../api";
import { mergeGrantedFeatures } from "./rules";
import { Character } from "../types";

export async function withProgression(c: Character): Promise<Character> {
  const data = await api.progression({
    class_name: c.clazz.name,
    ancestry: c.ancestry.name,
    level: c.level,
    custom_ancestry: !!c.ancestry.custom,
    deity: c.deity?.name,
  });
  return mergeGrantedFeatures(c, data.features);
}
