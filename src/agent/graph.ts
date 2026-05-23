import { StateGraph, END } from '@langchain/langgraph';
import { AuditStateAnnotation, type AuditState } from './state.js';
import { strategizeNode } from './nodes/strategize.js';
import { executeNode } from './nodes/execute.js';
import { evaluateNode } from './nodes/evaluate.js';
import { reportNode } from './nodes/report.js';

function shouldContinue(state: AuditState): 'strategize' | typeof END {
  return state.iterationCount < 3 ? 'strategize' : END;
}

export function buildAuditGraph() {
  const graph = new StateGraph(AuditStateAnnotation)
    .addNode('strategize', strategizeNode)
    .addNode('execute', executeNode)
    .addNode('evaluate', evaluateNode)
    .addNode('report', reportNode)
    .addEdge('__start__', 'strategize')
    .addEdge('strategize', 'execute')
    .addEdge('execute', 'evaluate')
    .addConditionalEdges('evaluate', shouldContinue, {
      strategize: 'strategize',
      [END]: 'report',
    })
    .addEdge('report', END);

  return graph.compile();
}
