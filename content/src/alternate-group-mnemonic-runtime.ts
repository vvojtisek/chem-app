import rawAlternatives from "../data/alternate-group-mnemonics.json";
import { alternateGroupMnemonicCollectionSchema } from "./alternate-group-mnemonic-schema";

export interface AlternateGroupMnemonicData {
  readonly groupNumber: number;
  readonly traditionalLabelCs: string;
  readonly mnemonicCs: string;
  readonly explanationCs: string;
}

const alternatives = alternateGroupMnemonicCollectionSchema.parse(rawAlternatives);

export const curatedAlternateGroupMnemonics: readonly AlternateGroupMnemonicData[] =
  alternatives.records
    .filter((record) => record.status === "owner-approved" || record.status === "reviewed")
    .map(({ groupNumber, traditionalLabelCs, mnemonicCs, explanationCs }) => ({
      groupNumber,
      traditionalLabelCs,
      mnemonicCs,
      explanationCs,
    }))
    .sort((left, right) => left.groupNumber - right.groupNumber);
