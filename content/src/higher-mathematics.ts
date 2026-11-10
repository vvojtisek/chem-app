import { mathTopic01 } from "./higher-mathematics/topic-01";
import { mathTopic02 } from "./higher-mathematics/topic-02";
import { mathTopic03 } from "./higher-mathematics/topic-03";
import { mathTopic04 } from "./higher-mathematics/topic-04";
import { mathTopic05 } from "./higher-mathematics/topic-05";
import { mathTopic06 } from "./higher-mathematics/topic-06";
import { mathTopic07 } from "./higher-mathematics/topic-07";
import { mathTopic08 } from "./higher-mathematics/topic-08";
import { mathTopic09 } from "./higher-mathematics/topic-09";
import type { MathTopic } from "./higher-mathematics/types";

/** Curriculum snapshot for the nine higher-mathematics practice topics. */
export const mathTopics = [
  mathTopic01,
  mathTopic02,
  mathTopic03,
  mathTopic04,
  mathTopic05,
  mathTopic06,
  mathTopic07,
  mathTopic08,
  mathTopic09,
] as const satisfies readonly MathTopic[];

export {
  mathTopic01,
  mathTopic02,
  mathTopic03,
  mathTopic04,
  mathTopic05,
  mathTopic06,
  mathTopic07,
  mathTopic08,
  mathTopic09,
};
export type {
  MathExercise,
  MathSolverProblem,
  MathSolverType,
  MathTheoryBlock,
  MathTopic,
} from "./higher-mathematics/types";
