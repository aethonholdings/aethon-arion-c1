// Mock the c1.model.constants to prevent circular dependency
jest.mock('../src/constants/c1.model.constants', () => ({
    C1ConfiguratorNames: { BASE: 'C1BaseConfigurator' },
    C1MatrixInitTypes: { RANDOM: 'random', PURPOSEFUL: 'purposeful', NULL: 'null', HYBRID: 'hybrid' },
    C1OptimiserNames: { GRADIENT_ASCENT: 'C1GradientAscent' }
}));

import { C1GradientAscentOptimiser } from '../src/classes/optimisers/c1-gradient-ascent.optimiser.class';
import {
    GradientAscentParameters,
    DomainTypes,
    SimSetDTO,
    States,
    ConvergenceTestDTO
} from 'aethon-arion-pipeline';
import { C1ConfiguratorParamData } from '../src/interfaces/c1.interfaces';

describe('C1GradientAscentOptimiser', () => {
    let optimizer: C1GradientAscentOptimiser;
    let mockModel: any;
    let simSetDTO: SimSetDTO;

    // Helper function to create mock ConvergenceTestDTO
    const createMockResult = (
        id: number,
        state: States,
        avgPerformance: number,
        configuratorParams: any
    ): ConvergenceTestDTO => {
        return {
            id,
            state,
            avgPerformance,
            configuratorParams,
            simConfigParams: {} as any,
            orgConfigCount: 1,
            simConfigCount: 1,
            completedSimConfigCount: 1,
            failedSimConfigCount: 0,
            runningSimConfigCount: 0,
            pendingSimConfigCount: 0,
            avgDurationSec: 100,
            stdDevPerformance: 0,
            convergenceMargin: 0.01,
            resultCount: 1,
            dispatchedRuns: 1,
            converged: state === States.COMPLETED,
            optimiserStates: []
        } as ConvergenceTestDTO;
    };

    beforeEach(() => {
        // Create a minimal mock model to avoid circular dependency
        // Using 'any' to bypass TypeScript checking since we're testing optimizer in isolation
        mockModel = {
            name: 'C1',
            index: 0
        };

        optimizer = new C1GradientAscentOptimiser(mockModel);
        simSetDTO = {
            id: 1,
            name: 'Test SimSet',
            description: 'Test simulation set',
            optimiserName: 'C1GradientAscent',
            modelName: 'C1',
            simConfigParams: {} as any
        } as SimSetDTO;
    });

    // Helper to create complete parameter space with C1 defaults
    const createCompleteParameterSpace = (optimizableParams: any[]) => {
        return [
            ...optimizableParams,
            // C1-specific required fields with defaults
            { id: 'layers', domain: { type: DomainTypes.DISCRETE, optimise: false, default: 1 } },
            { id: 'gains.influence', domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: 0.000001 } },
            { id: 'gains.judgment', domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: 0.00001 } },
            { id: 'gains.incentive', domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: 0.00000001 } },
            { id: 'graph', domain: { type: DomainTypes.CATEGORICAL, optimise: false, default: 'teams' } },
            { id: 'actionStateProbability', domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: 0.85 } },
            { id: 'matrixInit.influence', domain: { type: DomainTypes.CATEGORICAL, optimise: false, default: 'null' } },
            { id: 'matrixInit.judgment', domain: { type: DomainTypes.CATEGORICAL, optimise: false, default: 'random' } },
            { id: 'matrixInit.incentive', domain: { type: DomainTypes.CATEGORICAL, optimise: false, default: 'purposeful' } },
            { id: 'board.controlStep', domain: { type: DomainTypes.BOOLEAN, optimise: false, default: false } },
            { id: 'reporting.unitPrice', domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: 1 } },
            { id: 'reporting.unitPayroll', domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: 1 } }
        ];
    };

    describe('Initialization', () => {
        it('should initialize with random config', () => {
            const parameters: GradientAscentParameters = {
                init: { type: 'random' },
                parameterSpace: createCompleteParameterSpace([
                    {
                        id: 'spans',
                        domain: {
                            type: DomainTypes.DISCRETE,
                            optimise: true,
                            min: 1,
                            max: 5,
                            derivativeStepSize: 1
                        }
                    }
                ]),
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            expect(state).toBeDefined();
            expect(state.stepCount).toBe(0);
            expect(state.status).toBe(States.PENDING);
            expect(state.optimiserData.dataPoints).toBeDefined();

            const xPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'x');
            expect(xPoint).toBeDefined();
            expect(xPoint!.data.inputs.data.spans).toBeGreaterThanOrEqual(1);
            expect(xPoint!.data.inputs.data.spans).toBeLessThanOrEqual(5);
        });

        it('should initialize with defined config', () => {
            const definedConfig: C1ConfiguratorParamData = {
                spans: 2,
                layers: 2,
                gains: { influence: 0.000001, judgment: 0.00001, incentive: 0.00000001 },
                graph: 'teams',
                actionStateProbability: 0.85,
                matrixInit: { influence: 'null', judgment: 'random', incentive: 'purposeful' },
                board: { controlStep: false },
                reporting: { unitPrice: 1, unitPayroll: 1 }
            };

            const parameters: GradientAscentParameters = {
                init: { type: 'defined', config: definedConfig },
                parameterSpace: [
                    {
                        id: 'spans',
                        domain: {
                            type: DomainTypes.DISCRETE,
                            optimise: true,
                            min: 1,
                            max: 5,
                            derivativeStepSize: 1
                        }
                    }
                ],
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);
            const xPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'x');

            expect(xPoint!.data.inputs.data.spans).toBe(2);
            expect(xPoint!.data.inputs.data.layers).toBe(2);
        });
    });

    describe('Gradient Point Generation', () => {
        it('should generate gradient points for discrete domain', () => {
            const parameters: GradientAscentParameters = {
                init: { type: 'random' },
                parameterSpace: createCompleteParameterSpace([
                    {
                        id: 'spans',
                        domain: {
                            type: DomainTypes.DISCRETE,
                            optimise: true,
                            min: 1,
                            max: 5,
                            derivativeStepSize: 1
                        }
                    }
                ]),
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            // Should have x point + 1 gradient point
            expect(state.optimiserData.dataPoints.length).toBe(2);

            const gradientPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'spans');
            expect(gradientPoint).toBeDefined();
            expect(gradientPoint!.data.outputs.xDelta).toBeDefined();
            expect(gradientPoint!.data.outputs.xPlusDelta).toBeDefined();
            expect(Number.isInteger(gradientPoint!.data.outputs.xPlusDelta)).toBe(true);
        });

        it('should generate gradient points for boolean domain', () => {
            const parameters: GradientAscentParameters = {
                init: { type: 'random' },
                parameterSpace: [
                    ...createCompleteParameterSpace([]).filter(p => p.id !== 'board.controlStep'),
                    {
                        id: 'board.controlStep',
                        domain: {
                            type: DomainTypes.BOOLEAN,
                            optimise: true
                        }
                    }
                ],
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            const gradientPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'board.controlStep');
            expect(gradientPoint).toBeDefined();
            expect(typeof gradientPoint!.data.outputs.configuratorParameterValue).toBe('boolean');
            expect(gradientPoint!.data.outputs.xDelta).toBeUndefined();
        });

        it('should generate gradient points for categorical domain', () => {
            const parameters: GradientAscentParameters = {
                init: { type: 'random' },
                parameterSpace: [
                    ...createCompleteParameterSpace([]).filter(p => p.id !== 'graph'),
                    {
                        id: 'graph',
                        domain: {
                            type: DomainTypes.CATEGORICAL,
                            optimise: true,
                            categories: ['teams', 'top-down']
                        }
                    }
                ],
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            // Should have x point + 1 gradient point (2 categories - 1 current)
            expect(state.optimiserData.dataPoints.length).toBe(2);

            const gradientPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'graph');
            expect(gradientPoint).toBeDefined();
            expect(['teams', 'top-down']).toContain(gradientPoint!.data.outputs.configuratorParameterValue as string);
        });

        it('should handle boundary conditions for numerical domains', () => {
            const definedConfig: C1ConfiguratorParamData = {
                spans: 5, // at max boundary
                layers: 1,
                gains: { influence: 0.000001, judgment: 0.00001, incentive: 0.00000001 },
                graph: 'teams',
                actionStateProbability: 0.85,
                matrixInit: { influence: 'null', judgment: 'random', incentive: 'purposeful' },
                board: { controlStep: false },
                reporting: { unitPrice: 1, unitPayroll: 1 }
            };

            const parameters: GradientAscentParameters = {
                init: { type: 'defined', config: definedConfig },
                parameterSpace: [
                    {
                        id: 'spans',
                        domain: {
                            type: DomainTypes.DISCRETE,
                            optimise: true,
                            min: 1,
                            max: 5,
                            derivativeStepSize: 1
                        }
                    }
                ],
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            const gradientPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'spans');
            expect(gradientPoint).toBeDefined();
            // When at max, should step backward (negative xDelta)
            expect(gradientPoint!.data.outputs.xDelta).toBeLessThanOrEqual(0);
            expect(gradientPoint!.data.outputs.xPlusDelta).toBeLessThan(5);
        });
    });

    describe('State Updates with Results', () => {
        it('should update data points with convergence test results', () => {
            const parameters: GradientAscentParameters = {
                init: { type: 'random' },
                parameterSpace: createCompleteParameterSpace([
                    {
                        id: 'spans',
                        domain: {
                            type: DomainTypes.DISCRETE,
                            optimise: true,
                            min: 1,
                            max: 5,
                            derivativeStepSize: 1
                        }
                    }
                ]),
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            // Create mock results for all data points
            const results: ConvergenceTestDTO[] = state.optimiserData.dataPoints.map((dp, index) =>
                createMockResult(
                    index,
                    States.COMPLETED,
                    100 + index * 10,
                    dp.data.inputs
                )
            );

            const updatedState = optimizer.update(parameters, state, results);

            expect(updatedState.status).toBe(States.COMPLETED);
            expect(updatedState.percentComplete).toBe(100);
            expect(updatedState.performance).toBeDefined();

            const gradientPoint = updatedState.optimiserData.dataPoints.find(dp => dp.id === 'spans');
            expect(gradientPoint!.data.outputs.performance).toBeDefined();
            expect(gradientPoint!.data.outputs.performanceDelta).toBeDefined();
            expect(gradientPoint!.data.outputs.slope).toBeDefined();
        });

        it('should mark state as RUNNING when some results are running', () => {
            const parameters: GradientAscentParameters = {
                init: { type: 'random' },
                parameterSpace: createCompleteParameterSpace([
                    {
                        id: 'spans',
                        domain: {
                            type: DomainTypes.DISCRETE,
                            optimise: true,
                            min: 1,
                            max: 5,
                            derivativeStepSize: 1
                        }
                    }
                ]),
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            const results: ConvergenceTestDTO[] = state.optimiserData.dataPoints.map((dp, index) =>
                createMockResult(
                    index,
                    index === 0 ? States.COMPLETED : States.RUNNING,
                    100,
                    dp.data.inputs
                )
            );

            const updatedState = optimizer.update(parameters, state, results);

            expect(updatedState.status).toBe(States.RUNNING);
        });

        it('should throw error when results fail', () => {
            const parameters: GradientAscentParameters = {
                init: { type: 'random' },
                parameterSpace: createCompleteParameterSpace([
                    {
                        id: 'spans',
                        domain: {
                            type: DomainTypes.DISCRETE,
                            optimise: true,
                            min: 1,
                            max: 5,
                            derivativeStepSize: 1
                        }
                    }
                ]),
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            const results: ConvergenceTestDTO[] = state.optimiserData.dataPoints.map((dp, index) =>
                createMockResult(
                    index,
                    index === 0 ? States.FAILED : States.COMPLETED,
                    100,
                    dp.data.inputs
                )
            );

            expect(() => optimizer.update(parameters, state, results)).toThrow();
        });
    });

    describe('Step to Next State', () => {
        it('should step to next state with improved x for numerical domains', () => {
            const definedConfig: C1ConfiguratorParamData = {
                spans: 2,
                layers: 1,
                gains: { influence: 0.000001, judgment: 0.00001, incentive: 0.00000001 },
                graph: 'teams',
                actionStateProbability: 0.85,
                matrixInit: { influence: 'null', judgment: 'random', incentive: 'purposeful' },
                board: { controlStep: false },
                reporting: { unitPrice: 1, unitPayroll: 1 }
            };

            const parameters: GradientAscentParameters = {
                init: { type: 'defined', config: definedConfig },
                parameterSpace: [
                    {
                        id: 'spans',
                        domain: {
                            type: DomainTypes.DISCRETE,
                            optimise: true,
                            min: 1,
                            max: 5,
                            derivativeStepSize: 1
                        }
                    }
                ],
                iterations: {
                    tolerance: 0.01,
                    learningRate: 1.0, // Large learning rate for testing
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            const xPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'x');
            const gradientPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'spans');

            // Mock results showing positive slope
            const results: ConvergenceTestDTO[] = [
                createMockResult(1, States.COMPLETED, 100, xPoint!.data.inputs),
                createMockResult(2, States.COMPLETED, 150, gradientPoint!.data.inputs)
            ];

            const updatedState = optimizer.update(parameters, state, results);
            const nextState = optimizer.step(parameters, updatedState, results);

            expect(nextState.stepCount).toBe(1);
            expect(nextState.status).toBe(States.PENDING);

            const newXPoint = nextState.optimiserData.dataPoints.find(dp => dp.id === 'x');
            // Should have moved in direction of positive slope
            expect(newXPoint!.data.inputs.data.spans).toBeGreaterThan(2);
        });

        it('should choose best category for categorical domains', () => {
            const definedConfig: C1ConfiguratorParamData = {
                spans: 1,
                layers: 1,
                gains: { influence: 0.000001, judgment: 0.00001, incentive: 0.00000001 },
                graph: 'teams',
                actionStateProbability: 0.85,
                matrixInit: { influence: 'null', judgment: 'random', incentive: 'purposeful' },
                board: { controlStep: false },
                reporting: { unitPrice: 1, unitPayroll: 1 }
            };

            const parameters: GradientAscentParameters = {
                init: { type: 'defined', config: definedConfig },
                parameterSpace: [
                    {
                        id: 'graph',
                        domain: {
                            type: DomainTypes.CATEGORICAL,
                            optimise: true,
                            categories: ['teams', 'top-down']
                        }
                    }
                ],
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            const xPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'x');
            const gradientPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'graph');

            // Mock results showing 'top-down' performs better
            const results: ConvergenceTestDTO[] = [
                createMockResult(1, States.COMPLETED, 100, xPoint!.data.inputs),
                createMockResult(2, States.COMPLETED, 150, gradientPoint!.data.inputs)
            ];

            const updatedState = optimizer.update(parameters, state, results);
            const nextState = optimizer.step(parameters, updatedState, results);

            const newXPoint = nextState.optimiserData.dataPoints.find(dp => dp.id === 'x');
            // Should have switched to 'top-down'
            expect(newXPoint!.data.inputs.data.graph).toBe('top-down');
        });
    });

    describe('Convergence Testing', () => {
        it('should detect convergence when gradient modulo is below tolerance', () => {
            const parameters: GradientAscentParameters = {
                init: { type: 'random' },
                parameterSpace: createCompleteParameterSpace([
                    {
                        id: 'spans',
                        domain: {
                            type: DomainTypes.DISCRETE,
                            optimise: true,
                            min: 1,
                            max: 5,
                            derivativeStepSize: 1
                        }
                    }
                ]),
                iterations: {
                    tolerance: 1.0, // High tolerance
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            const results: ConvergenceTestDTO[] = state.optimiserData.dataPoints.map(dp =>
                createMockResult(
                    0,
                    States.COMPLETED,
                    100 + (dp.id === 'x' ? 0 : 0.001), // Tiny delta
                    dp.data.inputs
                )
            );

            const updatedState = optimizer.update(parameters, state, results);

            expect(updatedState.converged).toBe(true);
            expect(updatedState.optimiserData.moduloDel).toBeDefined();
        });
    });

    describe('CRITICAL BUG FIXES', () => {
        it('should select MAXIMUM performance (not minimum)', () => {
            const definedConfig: C1ConfiguratorParamData = {
                spans: 1,
                layers: 1,
                gains: { influence: 0.000001, judgment: 0.00001, incentive: 0.00000001 },
                graph: 'teams',
                actionStateProbability: 0.85,
                matrixInit: { influence: 'null', judgment: 'random', incentive: 'purposeful' },
                board: { controlStep: false },
                reporting: { unitPrice: 1, unitPayroll: 1 }
            };

            const parameters: GradientAscentParameters = {
                init: { type: 'defined', config: definedConfig },
                parameterSpace: [
                    {
                        id: 'graph',
                        domain: {
                            type: DomainTypes.CATEGORICAL,
                            optimise: true,
                            categories: ['teams', 'top-down', 'matrix']
                        }
                    }
                ],
                iterations: {
                    tolerance: 0.01,
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            const xPoint = state.optimiserData.dataPoints.find(dp => dp.id === 'x');
            const gradientPoints = state.optimiserData.dataPoints.filter(dp => dp.id === 'graph');

            // matrix has HIGHEST performance (200), top-down has medium (120)
            const results: ConvergenceTestDTO[] = [
                createMockResult(1, States.COMPLETED, 100, xPoint!.data.inputs),
                createMockResult(2, States.COMPLETED, 120, gradientPoints[0].data.inputs),
                createMockResult(3, States.COMPLETED, 200, gradientPoints[1].data.inputs)
            ];

            const updatedState = optimizer.update(parameters, state, results);
            const nextState = optimizer.step(parameters, updatedState, results);

            const newXPoint = nextState.optimiserData.dataPoints.find(dp => dp.id === 'x');

            // CRITICAL: Should select 'matrix' (highest = 200), NOT first item in ascending sort
            expect(newXPoint!.data.inputs.data.graph).toBe('matrix');
        });

        it('should properly square performance delta in convergence calculation', () => {
            const parameters: GradientAscentParameters = {
                init: { type: 'random' },
                parameterSpace: [
                    ...createCompleteParameterSpace([]).filter(p => p.id !== 'graph'),
                    {
                        id: 'graph',
                        domain: {
                            type: DomainTypes.CATEGORICAL,
                            optimise: true,
                            categories: ['teams', 'top-down']
                        }
                    }
                ],
                iterations: {
                    tolerance: 100, // High to check modulo calc
                    learningRate: 0.1,
                    max: 100
                }
            };

            const state = optimizer.initialise(parameters, simSetDTO);

            const results: ConvergenceTestDTO[] = state.optimiserData.dataPoints.map(dp =>
                createMockResult(
                    0,
                    States.COMPLETED,
                    100 + (dp.id === 'x' ? 0 : 10), // Delta = 10
                    dp.data.inputs
                )
            );

            const updatedState = optimizer.update(parameters, state, results);

            // Modulo should be sqrt(10^2) = 10
            expect(updatedState.optimiserData.moduloDel).toBe(10);
        });
    });
});
