import {
    AgentSetTensorsDTO,
    Utils,
    Configurator,
    OrgConfigDTO,
    ConfiguratorParamsDTO,
    StaticRandomStream
} from "aethon-arion-pipeline";
import {
    C1AgentStateIndex,
    C1AgentStatesArray,
    C1ConfiguratorNames,
    C1ModelClockTickSeconds,
    C1ModelName,
    C1PlantStateVariablesArray,
    C1ReportingVariablesArray,
    C1ReportingVariablesIndex
} from "../../constants/c1.model.constants";
import {
    C1ConfiguratorParamData,
    C1PlantConfig,
    C1ReportingConfig
} from "../../interfaces/c1.interfaces";
import { C1Model } from "../pipeline/c1-model.class";
import { C1BaseConfiguratorDefaultData, c1DefaultConfiguratorParamData } from "../../constants/c1.defaults.constants";
import { EigenvalueDecomposition, Matrix } from "ml-matrix";

/**
 * Base configurator for the C1 organizational coordination model.
 *
 * @remarks
 * The C1 model simulates hierarchical organizational behavior where agents coordinate
 * between two cognitive states: **Action** (task execution) and **Self** (reflection/planning).
 * This configurator generates multi-agent organizational structures with configurable
 * hierarchy topology, behavioral tensors, and performance incentives.
 *
 * **Model Architecture:**
 *
 * - **Agent States**: Binary state space {Action, Self}
 * - **Plant State**: Single degree of freedom representing aggregate organizational output
 * - **Organizational Graph**: Hierarchical tree or team-based lattice structure
 * - **Behavioral Tensors**:
 *   - Priority: Agent's internal state transition preferences
 *   - Influence: Inter-agent coordination dynamics
 *   - Judgment: Mapping from states to plant control actions
 *   - Incentive: Reward sensitivity to performance metrics
 *
 * **Hierarchy Generation:**
 *
 * Organizations are built using a tree structure with configurable spans and layers:
 * ```
 * Total agents (spans > 1): N = (S^L - 1) / (S - 1)
 * Total agents (spans = 1): N = L
 * ```
 * where S = span of control, L = hierarchical layers
 *
 * **Graph Topologies:**
 *
 * 1. **Top-Down**: Strict hierarchical tree (parent-child edges only)
 * 2. **Teams**: Hierarchical tree + intra-team lateral connections
 *
 * **Tensor Initialization Strategies:**
 *
 * - **Random**: Uniformly distributed values in [-gain, +gain]
 * - **Purposeful**: Designed values that encourage Action state and revenue maximization
 * - **Hybrid**: Purposeful structure with random perturbations
 *
 * **Purposeful Initialization Logic:**
 *
 * - **Influence**: Negative values (-gain × graph connectivity) to align states with neighbors
 * - **Judgment**: Action state → negative plant control, Self state → positive plant control
 * - **Incentive**: Action state penalized by revenue, Self state rewarded by revenue
 *
 * This creates tension where agents must balance task execution (Action) with strategic
 * planning (Self) based on performance feedback and peer influence.
 *
 * **Bug Fixes (v0.4.2):**
 *
 * - Fixed CRITICAL array index out of bounds in team graph generation (line 79-81)
 * - Fixed MEDIUM-HIGH division by zero when spans=0 (line 75)
 *
 * @example
 * ```typescript
 * // Create a 3-layer hierarchy with span of 3 (total: 13 agents)
 * const configurator = new C1BaseConfigurator(model);
 * const config = configurator.generate({
 *   modelName: "C1",
 *   configuratorName: "C1BaseConfigurator",
 *   multipleOrgConfigs: false,
 *   data: {
 *     spans: 3,        // 3 direct reports per manager
 *     layers: 3,       // 3 hierarchical levels
 *     gains: {
 *       influence: 0.00001,   // Low influence coupling
 *       judgment: 0.00001,    // Low action-plant coupling
 *       incentive: 0.00000001 // Very low incentive sensitivity
 *     },
 *     actionStateProbability: 0.85, // 85% bias toward Action state
 *     graph: "teams",                // Enable lateral team connections
 *     matrixInit: {
 *       influence: "hybrid",   // Purposeful + random noise
 *       judgment: "random",    // Fully random
 *       incentive: "purposeful" // Designed incentive structure
 *     },
 *     board: { controlStep: false },
 *     reporting: { unitPayroll: 1, unitPrice: 1 }
 *   }
 * });
 * // config.agentCount === 13
 * // config.plant.graph is 13×13 adjacency matrix
 * ```
 *
 * @public
 */
export class C1BaseConfigurator extends Configurator<
    C1ConfiguratorParamData> {
    /**
     * Number of discrete agent cognitive states in the C1 model.
     *
     * @remarks
     * C1 uses a binary state space:
     * - 0: Action (task execution, production)
     * - 1: Self (reflection, planning, coordination)
     *
     * Fixed at 2 for the C1 model.
     */
    stateCount: number = C1AgentStatesArray.length;

    /**
     * Degrees of freedom in the plant state (organizational output).
     *
     * @remarks
     * The plant represents the organization's production capacity or output level.
     * C1 uses a single degree of freedom representing aggregate action intensity.
     *
     * Fixed at 1 for the C1 model.
     */
    plantDegreesOfFreedom: number = C1PlantStateVariablesArray.length;

    /**
     * Degrees of freedom in the reporting variables (performance metrics).
     *
     * @remarks
     * Reporting variables include:
     * - Revenue
     * - Payroll costs
     * - Net income
     * - Headcount
     * - Unit payroll
     * - Unit price
     * - Clock tick seconds
     * - Clock ticks
     *
     * Fixed at 8 for the C1 model.
     */
    reportingDegreesOfFreedom: number = C1ReportingVariablesArray.length;

    /**
     * Creates a new C1BaseConfigurator instance.
     *
     * @param model - Parent C1 model instance
     *
     * @remarks
     * Initializes the configurator with the C1 model reference and registers
     * it under the name {@link C1ConfiguratorNames.BASE}.
     *
     * @example
     * ```typescript
     * const model = new C1Model();
     * const configurator = new C1BaseConfigurator(model);
     * ```
     */
    constructor(model: C1Model) {
        super(model, C1ConfiguratorNames.BASE);
    }

    /**
     * Generates a complete C1 organizational configuration from parameter data.
     *
     * @param params - Configuration parameters defining organizational structure and behavior
     * @returns Complete organization configuration ready for simulation
     *
     * @remarks
     * This method implements a multi-stage generation process:
     *
     * **Stage 1: Agent Count Calculation**
     *
     * Computes total agents from hierarchical structure:
     * ```
     * N = (S^L - 1) / (S - 1)  for S > 1  (geometric series)
     * N = L                     for S = 1  (linear chain)
     * ```
     * where S = spans (direct reports), L = layers (hierarchical depth)
     *
     * **Stage 2: Tensor Initialization**
     *
     * Creates zero-initialized behavioral tensors:
     * - Priority[α][σ][τ]: Agent α's preference for state transition σ→τ
     * - Influence[α][β][σ][τ]: Agent β's influence on agent α's σ→τ transition
     * - Judgment[α][σ][τ][γ]: Agent α's plant control mapping from state transition σ→τ to plant DOF γ
     * - Incentive[α][σ][τ][δ]: Agent α's reward sensitivity from state transition σ→τ to reporting variable δ
     *
     * **Stage 3: Organizational Graph Construction**
     *
     * Builds adjacency matrix representing reporting relationships:
     * - **Top-Down**: Hierarchical tree with parent-child edges
     * - **Teams**: Hierarchical tree + lateral edges within each team
     *
     * Graph construction algorithm:
     * 1. Add vertical edges (parent ↔ child) for all agents
     * 2. If graph="teams", add horizontal edges within each layer's spans
     * 3. Bounds checking: Ensure all indices < agentCount before setting edges
     *
     * **Stage 4: Matrix Value Assignment**
     *
     * Populates tensors based on initialization strategy:
     *
     * *Random Initialization:*
     * - Judgment: Uniform random in [-gain, +gain]
     * - Incentive: Uniform random in [-gain, +gain]
     * - Influence: Random × graph connectivity × gain
     *
     * *Purposeful Initialization:*
     * - Influence: -gain × graph[α][β] (negative coupling for state alignment)
     * - Judgment: [[-gain, +gain], [-gain, +gain]] (Action→negative, Self→positive plant control)
     * - Incentive: Action state → -gain × revenue, Self state → +gain × revenue
     *
     * *Hybrid Initialization:*
     * - Combines purposeful structure with random noise
     *
     * **Stage 5: Priority Tensor Configuration**
     *
     * Sets state transition probabilities based on actionStateProbability parameter:
     * ```
     * P(Action → Action) = actionStateProbability
     * P(Self → Action)   = actionStateProbability
     * P(Action → Self)   = 1 - actionStateProbability
     * P(Self → Self)     = 1 - actionStateProbability
     * ```
     *
     * Default: 0.85 based on Johnson (1986) empirical findings on task-switching behavior.
     *
     * **Stage 6: DTO Packaging**
     *
     * Assembles final configuration with:
     * - Agent count and behavioral tensors
     * - Organizational graph
     * - Plant initial state ([0])
     * - Reporting configuration (unit price, unit payroll)
     * - Board configuration (control step flag)
     * - Tensor intensity metrics (Frobenius norms)
     *
     * **Bug Fixes:**
     *
     * - **v0.4.2**: Added bounds check `beta + 1 < agentCount && alpha + 1 < agentCount` to prevent
     *   array index out of bounds when constructing team graph edges (line 79)
     * - **v0.4.2**: Added `spans !== 0` check to prevent division by zero in team graph logic (line 75)
     *
     * @example
     * ```typescript
     * const configurator = new C1BaseConfigurator(model);
     *
     * // Small team (5 agents: 1 manager + 4 reports)
     * const smallOrg = configurator.generate({
     *   modelName: "C1",
     *   configuratorName: "C1BaseConfigurator",
     *   multipleOrgConfigs: false,
     *   data: {
     *     spans: 4,
     *     layers: 2,
     *     gains: { influence: 0.00001, judgment: 0.00001, incentive: 0.00000001 },
     *     actionStateProbability: 0.85,
     *     graph: "top-down",
     *     matrixInit: { influence: "purposeful", judgment: "random", incentive: "purposeful" },
     *     board: { controlStep: false },
     *     reporting: { unitPayroll: 1, unitPrice: 1 }
     *   }
     * });
     * // smallOrg.agentCount === 5
     * // smallOrg.plant.graph is 5×5 tree adjacency matrix
     *
     * // Large organization (121 agents: 3^5 tree)
     * const largeOrg = configurator.generate({
     *   modelName: "C1",
     *   configuratorName: "C1BaseConfigurator",
     *   multipleOrgConfigs: false,
     *   data: {
     *     spans: 3,
     *     layers: 5,
     *     gains: { influence: 0.00001, judgment: 0.00001, incentive: 0.00000001 },
     *     actionStateProbability: 0.85,
     *     graph: "teams",
     *     matrixInit: { influence: "hybrid", judgment: "hybrid", incentive: "hybrid" },
     *     board: { controlStep: true },  // Board changes targets mid-simulation
     *     reporting: { unitPayroll: 1, unitPrice: 1 }
     *   }
     * });
     * // largeOrg.agentCount === 121
     * // largeOrg.plant.graph includes lateral team connections
     * ```
     *
     * @throws {Error} Implicitly throws if tensor dimensions are inconsistent
     */
    generate(params: ConfiguratorParamsDTO<C1ConfiguratorParamData>, randomSeed?: number): OrgConfigDTO {
        if (!Number.isInteger(params.data.spans) || params.data.spans < 1) {
            throw new Error(`spans must be an integer of at least 1 (got ${params.data.spans})`);
        }
        if (!Number.isInteger(params.data.layers) || params.data.layers < 1) {
            throw new Error(`layers must be an integer of at least 1 (got ${params.data.layers})`);
        }
        // the generated config keeps its own copy of the parameters
        params = JSON.parse(JSON.stringify(params));
        let agentCount: number;
        params.data.spans > 1
            ? (agentCount = (params.data.spans ** params.data.layers - 1) / (params.data.spans - 1))
            : (agentCount = params.data.layers);

        // initialise the org config tensors with zeroes
        const agentSetTensors: AgentSetTensorsDTO = {
            priorityTensor: Utils.tensor([agentCount, this.stateCount, this.stateCount], () => {
                return 0;
            }) as number[][][],
            influenceTensor: Utils.tensor([agentCount, agentCount, this.stateCount, this.stateCount], () => {
                return 0;
            }) as number[][][][],
            judgmentTensor: Utils.tensor(
                [agentCount, this.stateCount, this.stateCount, this.plantDegreesOfFreedom],
                () => {
                    return 0;
                }
            ) as number[][][][],
            incentiveTensor: Utils.tensor(
                [agentCount, this.stateCount, this.stateCount, this.reportingDegreesOfFreedom],
                () => {
                    return 0;
                }
            ) as number[][][][]
        };

        // generate the relationship graph matrix
        let parentAlpha: number = 0;
        let layer: number = 1;
        let layerAlphaEnd: number = params.data.spans;
        const graph: number[][] = Utils.tensor([agentCount, agentCount], () => {
            return 0;
        }) as number[][];
        for (let alpha = 1; alpha < agentCount; alpha++) {
            graph[parentAlpha][alpha] = 1;
            graph[alpha][parentAlpha] = 1;
            if (alpha % params.data.spans === 0) parentAlpha++;
            if (params.data.graph === "teams" && params.data.spans !== 1 && params.data.spans !== 0) {
                const startIndex = Math.floor(alpha / params.data.spans) * params.data.spans;
                const endIndex = startIndex + params.data.spans;
                for (let beta = startIndex; beta < endIndex; beta++) {
                    if (beta < agentCount && beta !== alpha && beta + 1 < agentCount && alpha + 1 < agentCount) {
                        graph[beta + 1][alpha + 1] = 1;
                        graph[alpha + 1][beta + 1] = 1;
                    }
                }
            }
            if (alpha === layerAlphaEnd) {
                layer++;
                layerAlphaEnd = layerAlphaEnd + params.data.spans ** layer;
            }
        }

        // Kernel initialisation per tensor (gain g = params.data.gains.<tensor>, U ~ uniform[0, 1)):
        //   null:       0
        //   random:     g * (2U - 1)
        //   purposeful: a kernel driving agents to the Action state (sign conventions below)
        //   hybrid:     purposeful + hybridNoise * g * (2U - 1), i.e. the purposeful kernel with noise
        // Influence entries are only set between agents connected in the org graph.
        const hybridNoise: number = params.data.hybridNoise ?? 0.5;
        // seeded draws when a seed is given (reproducible org configs, common random numbers across optimiser points)
        const stream = randomSeed !== undefined ? new StaticRandomStream(randomSeed) : null;
        const random = (): number => (stream ? stream.next() : Math.random());
        const uniform = (gain: number, amplitude: number = 1) => amplitude * gain * (2 * random() - 1);
        const init = params.data.matrixInit;
        const gains = params.data.gains;
        const repulsiveFraction: number = params.data.repulsiveFraction ?? 0;
        if (!(hybridNoise >= 0 && hybridNoise <= 1)) throw new Error(`hybridNoise must be in [0, 1] (got ${hybridNoise})`);
        if (!(repulsiveFraction >= 0 && repulsiveFraction <= 1)) {
            throw new Error(`repulsiveFraction must be in [0, 1] (got ${repulsiveFraction})`);
        }
        const consensusHours: number | null | undefined = params.data.influenceConsensusHours;
        if (consensusHours !== null && consensusHours !== undefined && !(consensusHours > 0)) {
            throw new Error(`influenceConsensusHours must be positive or null (got ${consensusHours})`);
        }
        const degree: number[] = graph.map((row) => row.reduce((acc, v) => acc + v, 0));
        // one repulsion draw per ordered pair of connected agents (an edge is attractive or repulsive as a whole)
        const repulsive: boolean[][] = graph.map((row) => row.map((edge) => edge === 1 && repulsiveFraction > 0 && random() < repulsiveFraction));

        for (let alpha = 0; alpha < agentCount; alpha++) {
            for (let sigma = 0; sigma < this.stateCount; sigma++) {
                for (let tau = 0; tau < this.stateCount; tau++) {
                    // influence: attraction towards graph neighbours, normalised by degree so that an agent's
                    // couplings sum to -g whatever its number of neighbours. "random" draws the strength of each
                    // coupling (not its sign: random signs make agreement between agents unstable), "hybrid" adds
                    // bounded noise to the purposeful strength; repulsiveFraction turns that share of the edges
                    // into repulsion
                    for (let beta = 0; beta < agentCount; beta++) {
                        if (!graph[alpha][beta]) {
                            agentSetTensors.influenceTensor[alpha][beta][sigma][tau] = 0;
                            continue;
                        }
                        // unit gain here; the tensor is scaled by the effective gain once it is known (below)
                        const share: number = 1 / degree[alpha];
                        let value = 0;
                        if (init.influence === "random") value = -share * random();
                        if (init.influence === "purposeful") value = -share;
                        if (init.influence === "hybrid") value = -share * (1 + hybridNoise * (2 * random() - 1));
                        agentSetTensors.influenceTensor[alpha][beta][sigma][tau] = repulsive[alpha][beta] ? -value : value;
                    }
                    // judgment: purposeful kernel -g towards Action, +g towards Self, per plant variable
                    for (let chi = 0; chi < this.plantDegreesOfFreedom; chi++) {
                        const purposeful = tau === C1AgentStateIndex.ACTION ? -gains.judgment : gains.judgment;
                        let value = 0;
                        if (init.judgment === "random") value = uniform(gains.judgment);
                        if (init.judgment === "purposeful") value = purposeful;
                        if (init.judgment === "hybrid") value = purposeful + uniform(gains.judgment, hybridNoise);
                        agentSetTensors.judgmentTensor[alpha][sigma][tau][chi] = value;
                    }
                    // incentive: purposeful kernel -g towards Action, +g towards Self on revenue only. The loop runs
                    // over the reporting dimensions (psi), not the agent states.
                    for (let psi = 0; psi < this.reportingDegreesOfFreedom; psi++) {
                        let purposeful = 0;
                        if (psi === C1ReportingVariablesIndex.REVENUE) {
                            purposeful = tau === C1AgentStateIndex.ACTION ? -gains.incentive : gains.incentive;
                        }
                        let value = 0;
                        if (init.incentive === "random") value = uniform(gains.incentive);
                        if (init.incentive === "purposeful") value = purposeful;
                        if (init.incentive === "hybrid") value = purposeful + uniform(gains.incentive, hybridNoise);
                        agentSetTensors.incentiveTensor[alpha][sigma][tau][psi] = value;
                    }
                }
            }
        }

        // effective influence gain: from the consensus time target when set, else gains.influence; either way within
        // the stability limit gain * clock tick <= 1 (Gershgorin bound on the degree-normalised coupling operator)
        const gainLimit: number = 1 / C1ModelClockTickSeconds;
        let influenceGain: number = gains.influence;
        let requiredGain: number | null = null;
        if (consensusHours !== null && consensusHours !== undefined && agentCount > 1) {
            requiredGain = c1GainForConsensusTime(agentSetTensors.influenceTensor, params.data.actionStateProbability, consensusHours);
            influenceGain = requiredGain === null ? 0 : Math.min(requiredGain, gainLimit);
        } else if (gains.influence > gainLimit) {
            throw new Error(`gains.influence ${gains.influence} exceeds the stability limit 1 / clockTickSeconds = ${gainLimit}`);
        }
        agentSetTensors.influenceTensor = agentSetTensors.influenceTensor.map((a) =>
            a.map((b) => b.map((row) => row.map((v) => v * influenceGain)))
        );

        // set up the priority tensor
        for (let alpha = 0; alpha < agentCount; alpha++) {
            agentSetTensors.priorityTensor[alpha][C1AgentStateIndex.ACTION][C1AgentStateIndex.ACTION] =
                params.data.actionStateProbability;
            agentSetTensors.priorityTensor[alpha][C1AgentStateIndex.SELF][C1AgentStateIndex.ACTION] =
                params.data.actionStateProbability;
            agentSetTensors.priorityTensor[alpha][C1AgentStateIndex.ACTION][C1AgentStateIndex.SELF] =
                1 - params.data.actionStateProbability;
            agentSetTensors.priorityTensor[alpha][C1AgentStateIndex.SELF][C1AgentStateIndex.SELF] =
                1 - params.data.actionStateProbability;
        }

        // package the configuration into the DTO
        const configDTO = {} as OrgConfigDTO;
        configDTO.type = C1ModelName;
        configDTO.clockTickSeconds = C1ModelClockTickSeconds;
        configDTO.board = {
            controlStep: params.data.board.controlStep
        };
        configDTO.plant = {
            initialState: [0],
            graph: graph
        } as C1PlantConfig;
        configDTO.configuratorParams = params;
        configDTO.reporting = {
            unitPrice: params.data.reporting?.unitPrice ?? C1BaseConfiguratorDefaultData.reporting.unitPrice,
            unitPayroll: params.data.reporting?.unitPayroll ?? C1BaseConfiguratorDefaultData.reporting.unitPayroll
        } as C1ReportingConfig;
        configDTO.agentCount = agentCount;
        configDTO.diagnostics = {
            ...c1InfluenceDiagnostics(
                agentSetTensors.influenceTensor,
                params.data.actionStateProbability,
                C1ModelClockTickSeconds,
                influenceGain
            ),
            influenceGain: influenceGain,
            consensusTargetHours: consensusHours ?? null,
            // false when the target needs a gain beyond the stability limit (the gain is capped at the limit and the
            // consensus time achieved is longer than the target)
            consensusTargetMet: requiredGain === null ? null : requiredGain <= gainLimit
        };
        configDTO.agentSet = agentSetTensors;
        configDTO.priorityIntensity = Utils.modulo(agentSetTensors.priorityTensor);
        configDTO.influenceIntensity = Utils.modulo(agentSetTensors.influenceTensor);
        configDTO.judgmentIntensity = Utils.modulo(agentSetTensors.judgmentTensor);
        configDTO.incentiveIntensity = Utils.modulo(agentSetTensors.incentiveTensor);
        return configDTO;
    }

    /**
     * Returns default parameter values for the C1 base configurator.
     *
     * @returns Default configuration parameters producing a minimal stable organization
     *
     * @remarks
     * Provides conservative defaults suitable for initial experimentation:
     *
     * **Organizational Structure:**
     * - Spans: 1 (linear chain, minimal coordination complexity)
     * - Layers: 1 (single agent, baseline individual behavior)
     * - Graph: "teams" (enables lateral connections when spans > 1)
     *
     * **Behavioral Gains:**
     * - Influence: 0.00001 (very weak peer influence)
     * - Judgment: 0.00001 (very weak action-plant coupling)
     * - Incentive: 0.00000001 (extremely weak performance sensitivity)
     *
     * **Rationale for Small Gains:**
     *
     * Small gains prevent unstable dynamics in early experiments. The C1 model
     * can exhibit chaotic behavior with strong coupling. These conservative values
     * ensure convergent simulations while allowing parameter sweep optimization
     * to discover effective gain combinations.
     *
     * **State Dynamics:**
     * - actionStateProbability: 0.85 (85% bias toward Action state)
     * - Based on Johnson (1986): empirical task-switching studies showing
     *   individuals spend ~85% of time in execution vs. 15% in planning
     *
     * **Initialization Strategy:**
     * - All tensors: "random" (unbiased exploration)
     * - Alternative: Use "purposeful" or "hybrid" for goal-directed initialization
     *
     * **Reporting:**
     * - unitPayroll: 1 (normalized cost per agent-second)
     * - unitPrice: 1 (normalized revenue per plant output unit)
     *
     * **Board Configuration:**
     * - controlStep: false (constant targets throughout simulation)
     * - Set to true to test step response and controllability
     *
     * @example
     * ```typescript
     * const configurator = new C1BaseConfigurator(model);
     * const defaults = configurator.getDefaultParams();
     *
     * // Modify defaults for specific experiment
     * const customParams = {
     *   ...defaults,
     *   data: {
     *     ...defaults.data,
     *     spans: 3,        // Expand to 3-way tree
     *     layers: 3,       // 3 hierarchical levels
     *     gains: {
     *       ...defaults.data.gains,
     *       incentive: 0.0001  // Increase incentive sensitivity
     *     }
     *   }
     * };
     *
     * const config = configurator.generate(customParams);
     * // config.agentCount === 13  (3^3 tree: (27-1)/(3-1) = 13)
     * ```
     */
    getDefaultParams(): ConfiguratorParamsDTO<C1ConfiguratorParamData> {
        return {
            modelName: C1ModelName,
            configuratorName: C1ConfiguratorNames.BASE,
            multipleOrgConfigs: true,
            data: c1DefaultConfiguratorParamData()
        };
    }
}

/**
 * Diagnostics of the influence coupling of a C1 org config, from the linearisation of the priority update around
 * agreement between agents. For two states, a disagreement dP evolves as dP <- dP + c * dt * (D - M) dP with
 * M[a][b] = I[a][b][s][Action] + I[a][b][s][Self], D = diag(row sums of M) and c = p(1 - p).
 *
 * - stable: no disagreement mode grows (every eigenvalue of D - M other than the agreement mode has real part <= 0)
 * - consensusTimeHours: e-folding time of the slowest-decaying disagreement mode (null when unstable or N = 1)
 * - growthTimeHours: e-folding time of the fastest-growing mode (null when stable)
 * - stepFactor: gain * dt; the update is free of overshoot for stepFactor <= 1
 */
export function c1InfluenceDiagnostics(
    influenceTensor: number[][][][],
    actionStateProbability: number,
    clockTickSeconds: number,
    gain: number
): { stable: boolean; consensusTimeHours: number | null; growthTimeHours: number | null; stepFactor: number } {
    const n = influenceTensor.length;
    const c = actionStateProbability * (1 - actionStateProbability) || 0.25;
    let worst = -Infinity; // largest real part over the non-agreement modes, over both source states
    for (let sigma = 0; sigma < 2 && n > 1; sigma++) {
        const m = influenceTensor.map((row) => row.map((entry) => entry[sigma][0] + entry[sigma][1]));
        const a = m.map((row, i) => row.map((v, j) => (i === j ? row.reduce((acc, x) => acc + x, 0) : 0) - v));
        const real: number[] = new EigenvalueDecomposition(new Matrix(a)).realEigenvalues;
        let agreement = 0;
        real.forEach((v, i) => {
            if (Math.abs(v) < Math.abs(real[agreement])) agreement = i;
        });
        for (let i = 0; i < real.length; i++) if (i !== agreement) worst = Math.max(worst, real[i]);
    }
    const hours = (rate: number) => (rate === 0 ? null : 1 / (c * clockTickSeconds * Math.abs(rate)) * (clockTickSeconds / 3600));
    const stable = !(worst > 1e-12);
    return {
        stable,
        consensusTimeHours: n > 1 && stable ? hours(worst) : null,
        growthTimeHours: n > 1 && !stable ? hours(worst) : null,
        stepFactor: gain * clockTickSeconds
    };
}

/**
 * The influence gain that makes the slowest disagreement mode decay with an e-folding time of `hours` simulated
 * hours, for a unit-gain influence tensor. The decay rate per second is c * g * |lambda|, with lambda the slowest
 * non-agreement eigenvalue of the unit coupling operator and c = p(1 - p), so g = 1 / (c * |lambda| * 3600 * hours)
 * (independent of the clock tick). Computed on the attractive version of the coupling (absolute strengths), so that
 * repulsive edges keep their meaning. Null when there is no coupling.
 */
export function c1GainForConsensusTime(
    unitInfluenceTensor: number[][][][],
    actionStateProbability: number,
    hours: number
): number | null {
    const attractive = unitInfluenceTensor.map((a) => a.map((b) => b.map((row) => row.map((v) => -Math.abs(v)))));
    const rate = slowestDecayRate(attractive);
    if (rate === null || rate === 0) return null;
    const c = actionStateProbability * (1 - actionStateProbability) || 0.25;
    return 1 / (c * rate * 3600 * hours);
}

/** |real part| of the slowest-decaying non-agreement mode of an attractive coupling, over both source states. */
function slowestDecayRate(influenceTensor: number[][][][]): number | null {
    const n = influenceTensor.length;
    if (n < 2) return null;
    let slowest = Infinity;
    for (let sigma = 0; sigma < 2; sigma++) {
        const m = influenceTensor.map((row) => row.map((entry) => entry[sigma][0] + entry[sigma][1]));
        const a = m.map((row, i) => row.map((v, j) => (i === j ? row.reduce((acc, x) => acc + x, 0) : 0) - v));
        const real: number[] = new EigenvalueDecomposition(new Matrix(a)).realEigenvalues;
        let agreement = 0;
        real.forEach((v, i) => {
            if (Math.abs(v) < Math.abs(real[agreement])) agreement = i;
        });
        for (let i = 0; i < real.length; i++) if (i !== agreement) slowest = Math.min(slowest, Math.abs(real[i]));
    }
    return Number.isFinite(slowest) ? slowest : null;
}
