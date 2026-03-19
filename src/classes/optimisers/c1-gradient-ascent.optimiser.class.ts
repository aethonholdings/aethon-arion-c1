import { C1ConfiguratorNames, C1MatrixInitTypes, C1OptimiserNames } from "../../constants/c1.model.constants";
import { C1ConfiguratorParamData } from "../../interfaces/c1.interfaces";
import {
    GradientAscentOptimiser,
    OptimiserStateDTO,
    States,
    ObjectHash,
    ConvergenceTestDTO,
    GradientAscentOptimiserData,
    DataPoint,
    GradientAscentOutput,
    ConfiguratorParamsDTO,
    GradientAscentParameters,
    SimSetDTO,
    DomainTypes,
    Domain
} from "aethon-arion-pipeline";
import { C1Model } from "../pipeline/c1-model.class";

const flatten = require("flat");

/**
 * Gradient ascent optimizer for C1 organizational configuration parameters.
 *
 * @remarks
 * Implements simulation-based gradient ascent to optimize C1 model parameters
 * for maximizing organizational performance metrics (e.g., revenue, efficiency).
 * Uses finite difference approximation to estimate gradients when analytical
 * derivatives are unavailable.
 *
 * **Optimization Algorithm:**
 *
 * 1. **Initialize**: Generate or use provided starting configuration
 * 2. **Simulate**: Run C1 simulation at current parameters (x)
 * 3. **Perturb**: For each optimizable parameter, simulate at x + δ
 * 4. **Gradient Estimation**: Compute ∂f/∂xᵢ ≈ (f(xᵢ + δ) - f(xᵢ)) / δ
 * 5. **Ascent Step**: Update parameters: xᵢ_new = xᵢ + α × ∂f/∂xᵢ
 * 6. **Convergence Test**: Check if gradient magnitude < tolerance
 * 7. **Iterate**: Repeat steps 2-6 until convergence or max iterations
 *
 * **C1-Specific Parameter Space:**
 *
 * The optimizer searches over C1 configuration parameters:
 * - **Organizational Structure**: spans, layers
 * - **Behavioral Gains**: influence, judgment, incentive
 * - **State Dynamics**: actionStateProbability
 * - **Initialization**: matrixInit types (random, purposeful, hybrid)
 * - **Graph Topology**: top-down vs. teams
 *
 * **Domain Handling:**
 *
 * - **Continuous** (e.g., gains): Numerical gradient with bounds enforcement
 * - **Discrete** (e.g., spans, layers): Integer-rounded gradients
 * - **Boolean** (e.g., controlStep): Binary flipping for gradient estimation
 * - **Categorical** (e.g., matrixInit types): Enumeration-based comparison
 *
 * **Convergence Criteria:**
 *
 * Optimization terminates when:
 * ```
 * ||∇f(x)|| = sqrt(Σ(∂f/∂xᵢ)²) < tolerance
 * ```
 * or max iterations reached.
 *
 * **Performance Metric:**
 *
 * The objective function f(x) is typically organizational revenue or net income
 * extracted from simulation results. Other metrics can be optimized by modifying
 * the convergence test logic.
 *
 * **Adaptive Step Sizing:**
 *
 * The finite difference step size (δ) adapts based on:
 * - Parameter domain bounds
 * - Derivative step size specification
 * - Boundary proximity (forward vs. backward differences)
 *
 * **State Management:**
 *
 * Optimizer state tracks:
 * - Current parameter point (x)
 * - Gradient evaluation points (x + δ for each parameter)
 * - Simulation results and performance values
 * - Convergence history (moduloDel trajectory)
 * - Iteration count and timing information
 *
 * **Multivariate Coordination:**
 *
 * Handles coupled parameters (e.g., influence/judgment/incentive gains)
 * by computing partial derivatives independently, then combining into
 * gradient vector for simultaneous update.
 *
 * **Bug Fixes (v0.4.2):**
 *
 * - Fixed HIGH severity null pointer bug when bestDataPoint is undefined (line 425-435)
 * - Added null check before accessing bestDataPoint properties
 *
 * @example
 * ```typescript
 * const model = new C1Model();
 * const optimiser = new C1GradientAscentOptimiser(model);
 *
 * const parameters: GradientAscentParameters = {
 *   iterations: {
 *     learningRate: 0.01,
 *     tolerance: 0.001,
 *     max: 50
 *   },
 *   parameterSpace: {
 *     "gains.influence": {
 *       type: "continuous",
 *       min: 0.000001,
 *       max: 0.0001,
 *       optimise: true,
 *       derivativeStepSize: 0.000001
 *     },
 *     "gains.judgment": {
 *       type: "continuous",
 *       min: 0.000001,
 *       max: 0.0001,
 *       optimise: true,
 *       derivativeStepSize: 0.000001
 *     },
 *     "actionStateProbability": {
 *       type: "continuous",
 *       min: 0.5,
 *       max: 0.95,
 *       optimise: true,
 *       derivativeStepSize: 0.01
 *     }
 *   },
 *   init: { type: "random" }
 * };
 *
 * // Initialize optimization
 * const simSetDTO = { id: "opt-001", name: "Revenue Optimization" };
 * const initialState = optimiser.initialise(parameters, simSetDTO);
 *
 * // Optimization loop (typically handled by orchestrator)
 * let state = initialState;
 * while (!state.converged && state.stepCount < parameters.iterations.max) {
 *   // Get configurations to simulate
 *   const configs = optimiser.getStateRequiredConfiguratorParams(state);
 *
 *   // Run simulations (external system)
 *   const results = await runSimulations(configs);
 *
 *   // Update state with results
 *   state = optimiser.update(parameters, state, results);
 *
 *   // Generate next iteration
 *   if (!state.converged) {
 *     state = optimiser.step(parameters, state, results);
 *   }
 * }
 *
 * console.log(`Converged in ${state.stepCount} iterations`);
 * console.log(`Optimal gains: influence=${optimalConfig.gains.influence}`);
 * ```
 *
 * @public
 */
export class C1GradientAscentOptimiser extends GradientAscentOptimiser<
    C1ConfiguratorParamData,
    GradientAscentParameters,
    GradientAscentOptimiserData<C1ConfiguratorParamData>
> {
    /**
     * Name of the C1 configurator used to generate organizational configurations.
     *
     * @remarks
     * Fixed to {@link C1ConfiguratorNames.BASE} for this implementation.
     * Used to retrieve the correct configurator from the model when generating
     * organizational configurations from optimized parameters.
     *
     * @private
     */
    private _configuratorName: string;

    /**
     * Creates a new C1GradientAscentOptimiser instance.
     *
     * @param model - Parent C1 model instance
     *
     * @remarks
     * Initializes the optimizer with the C1 model reference and sets the
     * configurator name to {@link C1ConfiguratorNames.BASE}.
     *
     * @example
     * ```typescript
     * const model = new C1Model();
     * const optimiser = new C1GradientAscentOptimiser(model);
     * ```
     */
    constructor(model: C1Model) {
        super(C1OptimiserNames.GRADIENT_ASCENT, model);
        this._configuratorName = C1ConfiguratorNames.BASE;
    }

    /**
     * Initializes the optimization state with starting configuration and gradient evaluation points.
     *
     * @param parameters - Gradient ascent configuration including learning rate, tolerance, and parameter space
     * @param simSetDTO - Simulation set metadata for tracking the optimization run
     * @returns Initial optimizer state ready for simulation execution
     *
     * @remarks
     * Creates the starting point for optimization by:
     *
     * **Step 1: Generate Initial Configuration (x₀)**
     *
     * - **Random Init**: Sample uniformly from parameter space bounds
     * - **Defined Init**: Use provided configuration from parameters.init.config
     *
     * **Step 2: Create Gradient Evaluation Points (x₀ + δᵢ)**
     *
     * For each optimizable parameter i:
     * - Calculate step size: δᵢ = derivativeStepSize (from domain spec)
     * - Create perturbed configuration: xᵢ + δᵢ
     * - Handle boundary conditions:
     *   - If xᵢ + δᵢ > max: Use backward difference (xᵢ - δᵢ)
     *   - If xᵢ - δᵢ < min: Use forward difference (xᵢ + δᵢ)
     *
     * **Step 3: Construct State DTO**
     *
     * Returns state with:
     * - dataPoints: [x₀, x₀+δ₁, x₀+δ₂, ..., x₀+δₙ]
     * - status: PENDING (awaiting simulation results)
     * - stepCount: 0 (initial iteration)
     * - converged: false
     *
     * **State Structure:**
     *
     * The returned state contains N+1 data points where N = number of optimizable parameters:
     * - 1 evaluation at current point (x)
     * - N gradient evaluations (one per parameter)
     *
     * Each data point includes:
     * - inputs: ConfiguratorParamsDTO (configuration to simulate)
     * - outputs: GradientAscentOutput (placeholder for results)
     *
     * **Example Parameter Space:**
     *
     * If optimizing 3 parameters (influence, judgment, actionStateProbability),
     * the initial state will have 4 data points:
     * - x₀ (base configuration)
     * - x₀ + δ_influence
     * - x₀ + δ_judgment
     * - x₀ + δ_actionStateProbability
     *
     * All 4 configurations must be simulated before calling {@link update}.
     *
     * @example
     * ```typescript
     * const optimiser = new C1GradientAscentOptimiser(model);
     * const parameters: GradientAscentParameters = {
     *   iterations: { learningRate: 0.01, tolerance: 0.001, max: 50 },
     *   parameterSpace: {
     *     "gains.influence": {
     *       type: "continuous",
     *       min: 0.000001,
     *       max: 0.0001,
     *       optimise: true,
     *       derivativeStepSize: 0.000001
     *     }
     *   },
     *   init: { type: "random" }
     * };
     *
     * const simSet = { id: "opt-001", name: "Gain Optimization" };
     * const state = optimiser.initialise(parameters, simSet);
     *
     * console.log(state.optimiserData.dataPoints.length); // 2 (x₀ + gradient point)
     * console.log(state.stepCount); // 0
     * console.log(state.status); // "pending"
     * ```
     */
    initialise(
        parameters: GradientAscentParameters,
        simSetDTO: SimSetDTO
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        return this._createInitialState(parameters, simSetDTO);
    }

    /**
     * Generates the next optimization iteration state by stepping along the gradient.
     *
     * @param parameters - Gradient ascent configuration
     * @param stateDTO - Current optimizer state (must have status COMPLETED)
     * @param resultsDTO - Simulation results (required but not used by this method)
     * @returns New optimizer state for the next iteration
     *
     * @remarks
     * Creates the next iteration by applying the gradient ascent update rule:
     * ```
     * x_new = x_old + α × ∇f(x_old)
     * ```
     * where α = learning rate, ∇f = gradient vector
     *
     * **Algorithm:**
     *
     * 1. **Validate State**: Ensure previous iteration is COMPLETED
     * 2. **Extract Gradients**: Retrieve ∂f/∂xᵢ for each parameter from previous state
     * 3. **Apply Update Rule**: For each parameter:
     *    ```
     *    xᵢ_new = xᵢ_old + learningRate × ∂f/∂xᵢ
     *    ```
     * 4. **Enforce Bounds**: Clamp updated values to [min, max]
     * 5. **Handle Discrete Parameters**: Round to integers if domain is discrete
     * 6. **Generate New Gradient Points**: Create perturbations for next gradient estimation
     * 7. **Reset State**: Set status to PENDING, increment stepCount
     *
     * **Gradient Extraction:**
     *
     * Gradients are extracted from the previous state's data points:
     * - Find data point with role "x" (current evaluation)
     * - Find data points with role matching parameter IDs (gradient evaluations)
     * - Extract slope from each gradient data point's outputs
     *
     * **Boundary Handling:**
     *
     * - **Continuous**: Clip to [min, max]
     * - **Discrete**: Round to nearest integer, then clip
     * - **Boolean**: Convert to 0/1, then to boolean
     * - **Categorical**: Select nearest valid category
     *
     * **Convergence Check:**
     *
     * This method does NOT test convergence. Call {@link update} after simulating
     * the returned state's configurations to perform convergence testing.
     *
     * @throws {Error} If stateDTO or resultsDTO are undefined
     * @throws {Error} If previous state status is not COMPLETED
     *
     * @example
     * ```typescript
     * // After initial state is simulated and updated
     * const nextState = optimiser.step(parameters, currentState, results);
     *
     * console.log(nextState.stepCount); // currentState.stepCount + 1
     * console.log(nextState.status); // "pending"
     * console.log(nextState.optimiserData.dataPoints.length); // Same as initial (N+1)
     *
     * // Simulate next state's configurations
     * const configs = optimiser.getStateRequiredConfiguratorParams(nextState);
     * const nextResults = await runSimulations(configs);
     *
     * // Update and check convergence
     * const updatedState = optimiser.update(parameters, nextState, nextResults);
     * if (updatedState.converged) {
     *   console.log("Optimization complete!");
     * }
     * ```
     */
    step(
        parameters: GradientAscentParameters,
        stateDTO?: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>,
        resultsDTO?: ConvergenceTestDTO[]
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        if (!stateDTO || !resultsDTO) {
            throw new Error("Optimiser step requires a state and resultDTO");
        }
        return this._createNextState(parameters, stateDTO);
    }

    /**
     * Updates optimizer state with simulation results and tests for convergence.
     *
     * @param parameters - Gradient ascent configuration
     * @param state - Current optimizer state with PENDING data points
     * @param results - Simulation results corresponding to state's configurations
     * @returns Updated state with results incorporated and convergence status
     *
     * @remarks
     * Processes simulation results and updates optimization state:
     *
     * **Step 1: Match Results to Data Points**
     *
     * - Compares result configuration hashes to data point input hashes
     * - Populates data point outputs with performance metrics
     * - Extracts objective function value (e.g., revenue) from results
     *
     * **Step 2: Calculate Gradients**
     *
     * For each parameter i with completed evaluations:
     * ```
     * ∂f/∂xᵢ = (f(xᵢ + δᵢ) - f(xᵢ)) / δᵢ
     * ```
     *
     * Stores gradient in data point's outputs.slope field.
     *
     * **Step 3: Update State Status**
     *
     * - **PENDING**: Some data points still awaiting results
     * - **IN_PROGRESS**: Partial results received
     * - **COMPLETED**: All data points have results
     *
     * **Step 4: Convergence Testing (if COMPLETED)**
     *
     * When all results are available:
     * - Calculate gradient magnitude: `||∇f|| = sqrt(Σ(∂f/∂xᵢ)²)`
     * - Compare to tolerance: `converged = (||∇f|| < tolerance)`
     * - Store gradient modulo (magnitude) in state.optimiserData.moduloDel
     * - Set end timestamp and duration
     *
     * **Convergence Criteria:**
     *
     * Optimization converges when:
     * ```
     * sqrt(Σᵢ (∂f/∂xᵢ)²) < tolerance
     * ```
     *
     * This indicates the gradient is nearly zero, meaning we're at a local maximum
     * (or saddle point) of the objective function.
     *
     * **Performance Metric Extraction:**
     *
     * The objective function value is typically extracted from:
     * - ResultDTO → reporting → revenue (index 0)
     * - Or net income, or custom performance metric
     *
     * Modify `_testConvergence` method to optimize different metrics.
     *
     * **State Mutation:**
     *
     * This method modifies the input state object in place and returns it.
     * The state object is updated with:
     * - Populated data point outputs
     * - Updated status
     * - Convergence flag and gradient modulo
     * - Timing information
     *
     * @throws {Error} If state or results are undefined
     *
     * @example
     * ```typescript
     * // After simulating state's required configurations
     * const state = optimiser.initialise(parameters, simSet);
     * const configs = optimiser.getStateRequiredConfiguratorParams(state);
     * const results = await runSimulations(configs);
     *
     * // Update state with results
     * const updatedState = optimiser.update(parameters, state, results);
     *
     * console.log(updatedState.status); // "completed"
     * console.log(updatedState.converged); // true/false
     * console.log(updatedState.optimiserData.moduloDel); // e.g., 0.0005 (gradient magnitude)
     *
     * if (updatedState.converged) {
     *   const xPoint = updatedState.optimiserData.dataPoints.find(p => p.data.outputs.id === "x");
     *   console.log("Optimal configuration:", xPoint.data.inputs.data);
     * } else {
     *   // Generate next iteration
     *   const nextState = optimiser.step(parameters, updatedState, results);
     * }
     * ```
     */
    update(
        parameters: GradientAscentParameters,
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>,
        results: ConvergenceTestDTO[]
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        if (!state || !results) {
            throw new Error("Invalid parameters for update; provide both state and results");
        }

        const parameterDomains = this._getParameterDomains(parameters);

        // Update all data points with their corresponding results
        this._updateDataPointsWithResults(state, results, parameterDomains);

        // Update overall state status
        this._updateStateStatus(state);

        // Test for convergence if all data points are completed
        if (state.status === States.COMPLETED) {
            const convergenceTest = this._testConvergence(parameters, state);
            state.converged = convergenceTest.converged;
            state.optimiserData.moduloDel = convergenceTest.modulo;
            state.end = new Date();
            state.durationSec = state.start ? (state.end.getTime() - state.start.getTime()) / 1000 : undefined;
        }

        return state;
    }

    /**
     * Extracts configuration parameters required for simulating the current state.
     *
     * @param state - Optimizer state containing data points to simulate
     * @returns Array of configurator parameter DTOs ready for simulation
     *
     * @remarks
     * Maps optimizer state data points to simulation configurations:
     *
     * **Mapping Process:**
     *
     * For each data point in state.optimiserData.dataPoints:
     * - Extract inputs (ConfiguratorParamsDTO)
     * - Return as array element
     *
     * **Array Structure:**
     *
     * Returned array contains N+1 configurations where N = optimizable parameters:
     * ```
     * [
     *   x₀,          // Current evaluation point
     *   x₀ + δ₁,     // Gradient evaluation for parameter 1
     *   x₀ + δ₂,     // Gradient evaluation for parameter 2
     *   ...
     *   x₀ + δₙ      // Gradient evaluation for parameter N
     * ]
     * ```
     *
     * **Usage Pattern:**
     *
     * This method is typically called immediately after {@link initialise} or {@link step}
     * to obtain the configurations that need to be simulated before calling {@link update}.
     *
     * **Simulation Orchestration:**
     *
     * 1. Call this method to get configs
     * 2. Pass configs to simulation engine (external)
     * 3. Collect simulation results
     * 4. Pass results to {@link update} for gradient calculation
     *
     * **Configuration Format:**
     *
     * Each returned ConfiguratorParamsDTO contains:
     * - modelName: "C1"
     * - configuratorName: "C1BaseConfigurator"
     * - data: C1ConfiguratorParamData (spans, layers, gains, etc.)
     *
     * These can be directly passed to {@link C1BaseConfigurator.generate} to create
     * OrgConfigDTO instances for simulation.
     *
     * @example
     * ```typescript
     * const state = optimiser.initialise(parameters, simSet);
     * const configs = optimiser.getStateRequiredConfiguratorParams(state);
     *
     * console.log(configs.length); // e.g., 4 (1 base + 3 gradient evaluations)
     *
     * // Simulate each configuration
     * const results = await Promise.all(
     *   configs.map(async (config) => {
     *     const orgConfig = configurator.generate(config);
     *     const result = await simulator.run(orgConfig);
     *     return {
     *       configHash: hash(config),
     *       performance: result.reporting[0], // revenue
     *       ...result
     *     };
     *   })
     * );
     *
     * // Update state with results
     * const updatedState = optimiser.update(parameters, state, results);
     * ```
     */
    getStateRequiredConfiguratorParams(
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>
    ): ConfiguratorParamsDTO<C1ConfiguratorParamData>[] {
        return state.optimiserData.dataPoints.map((dataPoint) => dataPoint.data.inputs);
    }

    // ============================================================================
    // PRIVATE METHODS - State Creation
    // ============================================================================

    private _createInitialState(
        parameters: GradientAscentParameters,
        simSetDTO: SimSetDTO
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        // Generate initial x point (random or defined)
        const initialConfig = parameters.init.type === "random"
            ? this._getRandomInit(parameters)
            : parameters.init.config;

        const xDataPoint = this._createDataPoint("x", initialConfig);
        const gradientPoints = this._generateGradientPoints(parameters, xDataPoint);

        return {
            modelName: this.model.name,
            optimiserName: this.name,
            converged: false,
            start: new Date(),
            percentComplete: 0,
            status: States.PENDING,
            stepCount: 0,
            simSet: simSetDTO,
            optimiserData: {
                dataPoints: [xDataPoint, ...gradientPoints]
            }
        } as OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>;
    }

    private _createNextState(
        parameters: GradientAscentParameters,
        previousState: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        if (previousState.status !== States.COMPLETED) {
            throw new Error("Cannot step from a state that is not completed");
        }

        const parameterDomains = this._getParameterDomains(parameters);
        const previousX = this._getXDataPoint(previousState);

        // Calculate new x by stepping along gradient
        const newXConfig = this._calculateNextX(parameters, previousState, previousX, parameterDomains);
        const newXDataPoint = this._createDataPoint("x", newXConfig);
        const gradientPoints = this._generateGradientPoints(parameters, newXDataPoint);

        return {
            stepCount: previousState.stepCount + 1,
            simSet: previousState.simSet,
            status: States.PENDING,
            converged: false,
            percentComplete: 0,
            modelName: previousState.modelName,
            optimiserName: previousState.optimiserName,
            optimiserData: {
                dataPoints: [newXDataPoint, ...gradientPoints],
                moduloDel: undefined
            }
        } as OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>;
    }

    // ============================================================================
    // PRIVATE METHODS - Gradient Point Generation
    // ============================================================================

    private _generateGradientPoints(
        parameters: GradientAscentParameters,
        xDataPoint: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>
    ): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[] {
        const parameterDomains = this._getParameterDomains(parameters);
        const xConfigFlat = flatten(xDataPoint.data.inputs.data);
        const gradientPoints: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[] = [];

        for (const [parameterId, domain] of Object.entries(parameterDomains)) {
            if (!domain.optimise) continue;

            const currentValue = xConfigFlat[parameterId];

            if (domain.type === DomainTypes.CONTINUOUS || domain.type === DomainTypes.DISCRETE) {
                const point = this._createNumericalGradientPoint(parameterId, currentValue, domain, xConfigFlat);
                gradientPoints.push(point);
            } else if (domain.type === DomainTypes.BOOLEAN) {
                const point = this._createBooleanGradientPoint(parameterId, currentValue, domain, xConfigFlat);
                gradientPoints.push(point);
            } else if (domain.type === DomainTypes.CATEGORICAL) {
                const points = this._createCategoricalGradientPoints(parameterId, currentValue, domain, xConfigFlat);
                gradientPoints.push(...points);
            }
        }

        return gradientPoints;
    }

    private _createNumericalGradientPoint(
        parameterId: string,
        currentValue: number,
        domain: Domain,
        xConfigFlat: any
    ): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput> {
        // Type guard: ensure domain has numerical properties
        if (!domain.optimise || (domain.type !== DomainTypes.CONTINUOUS && domain.type !== DomainTypes.DISCRETE)) {
            throw new Error(`Domain ${parameterId} is not an optimisable numerical domain`);
        }

        // Calculate step size (derivative step)
        let stepSize: number;
        if (currentValue < domain.max) {
            // Step forward if not at max
            stepSize = Math.min(domain.derivativeStepSize, domain.max - currentValue);
        } else {
            // Step backward if at max boundary
            stepSize = -Math.min(domain.derivativeStepSize, currentValue - domain.min);
        }

        const perturbedValue = currentValue + stepSize;
        const perturbedConfigFlat = { ...xConfigFlat, [parameterId]: perturbedValue };
        const perturbedConfig = flatten.unflatten(perturbedConfigFlat);

        const output: GradientAscentOutput = {
            id: parameterId,
            domain: domain,
            configuratorParameterValue: perturbedValue,
            xPlusDelta: perturbedValue,
            xDelta: stepSize,
            slope: undefined,
            performance: undefined,
            performanceDelta: undefined
        };

        return this._createDataPoint(parameterId, perturbedConfig, output);
    }

    private _createBooleanGradientPoint(
        parameterId: string,
        currentValue: boolean,
        domain: Domain,
        xConfigFlat: any
    ): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput> {
        const perturbedValue = !currentValue;
        const perturbedConfigFlat = { ...xConfigFlat, [parameterId]: perturbedValue };
        const perturbedConfig = flatten.unflatten(perturbedConfigFlat);

        const output: GradientAscentOutput = {
            id: parameterId,
            domain: domain,
            configuratorParameterValue: perturbedValue,
            xPlusDelta: undefined,
            xDelta: undefined,
            slope: undefined,
            performance: undefined,
            performanceDelta: undefined
        };

        return this._createDataPoint(parameterId, perturbedConfig, output);
    }

    private _createCategoricalGradientPoints(
        parameterId: string,
        currentValue: string,
        domain: Domain,
        xConfigFlat: any
    ): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[] {
        // Type guard: ensure domain is categorical
        if (domain.type !== DomainTypes.CATEGORICAL || !domain.optimise) {
            throw new Error(`Domain ${parameterId} is not an optimisable categorical domain`);
        }

        if (!domain.categories || domain.categories.length === 0) {
            throw new Error(`Domain ${parameterId} is categorical but has no categories defined`);
        }

        const points: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[] = [];
        const currentCategoryIndex = domain.categories.indexOf(currentValue);

        // Create a gradient point for each alternative category
        for (let i = 0; i < domain.categories.length; i++) {
            if (i === currentCategoryIndex) continue; // Skip current value

            const perturbedValue = domain.categories[i];
            const perturbedConfigFlat = { ...xConfigFlat, [parameterId]: perturbedValue };
            const perturbedConfig = flatten.unflatten(perturbedConfigFlat);

            const output: GradientAscentOutput = {
                id: parameterId,
                domain: domain,
                configuratorParameterValue: perturbedValue,
                xPlusDelta: undefined,
                xDelta: undefined,
                slope: undefined,
                performance: undefined,
                performanceDelta: undefined
            };

            points.push(this._createDataPoint(parameterId, perturbedConfig, output));
        }

        return points;
    }

    // ============================================================================
    // PRIVATE METHODS - State Updates
    // ============================================================================

    private _updateDataPointsWithResults(
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>,
        results: ConvergenceTestDTO[],
        parameterDomains: { [key: string]: Domain }
    ): void {
        const xDataPoint = this._getXDataPoint(state);
        const xResult = results.find((result) => result.configuratorParams.hash === xDataPoint.data.inputs.hash);

        if (!xResult) {
            throw new Error(`Result for x point not found in optimiser state ${state.id}`);
        }

        // Update x point performance
        xDataPoint.data.outputs.performance = xResult.avgPerformance;
        xDataPoint.status = xResult.state;
        state.performance = xResult.avgPerformance;

        // Update all gradient points
        for (const dataPoint of state.optimiserData.dataPoints) {
            if (dataPoint.id === "x") continue;

            const result = results.find((r) => r.configuratorParams.hash === dataPoint.data.inputs.hash);
            if (!result) {
                throw new Error(`Result not found for data point ${dataPoint.id} in optimiser state ${state.id}`);
            }

            dataPoint.status = result.state;
            dataPoint.data.outputs.performance = result.avgPerformance;
            dataPoint.data.outputs.performanceDelta = result.avgPerformance - xResult.avgPerformance;

            const domain = parameterDomains[dataPoint.id];
            if (!domain) continue;

            // Calculate slope for numerical domains
            if ((domain.type === DomainTypes.CONTINUOUS || domain.type === DomainTypes.DISCRETE) &&
                dataPoint.data.outputs.xDelta !== undefined &&
                dataPoint.data.outputs.performanceDelta !== undefined) {
                dataPoint.data.outputs.slope = dataPoint.data.outputs.performanceDelta / dataPoint.data.outputs.xDelta;
            }
        }
    }

    private _updateStateStatus(
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>
    ): void {
        let allCompleted = true;
        let anyRunning = false;
        let anyFailed = false;

        for (const dataPoint of state.optimiserData.dataPoints) {
            if (dataPoint.status !== States.COMPLETED) allCompleted = false;
            if (dataPoint.status === States.RUNNING) anyRunning = true;
            if (dataPoint.status === States.FAILED) anyFailed = true;
        }

        if (anyFailed) {
            state.status = States.FAILED;
            state.percentComplete = undefined;
            throw new Error("Optimiser state update failed; one or more results failed");
        } else if (allCompleted) {
            state.status = States.COMPLETED;
            state.percentComplete = 100;
        } else if (anyRunning) {
            state.status = States.RUNNING;
        }
    }

    // ============================================================================
    // PRIVATE METHODS - Next X Calculation
    // ============================================================================

    private _calculateNextX(
        parameters: GradientAscentParameters,
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>,
        previousX: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>,
        parameterDomains: { [key: string]: Domain }
    ): C1ConfiguratorParamData {
        const previousXConfigFlat = flatten(previousX.data.inputs.data);
        const newXConfigFlat = { ...previousXConfigFlat };

        for (const [parameterId, domain] of Object.entries(parameterDomains)) {
            if (!domain.optimise) continue;

            const gradientDataPoints = state.optimiserData.dataPoints.filter(dp => dp.id === parameterId);
            if (gradientDataPoints.length === 0) continue;

            const currentValue = previousXConfigFlat[parameterId];

            if (domain.type === DomainTypes.CONTINUOUS || domain.type === DomainTypes.DISCRETE) {
                newXConfigFlat[parameterId] = this._calculateNextNumericalValue(
                    parameters,
                    currentValue,
                    gradientDataPoints,
                    domain
                );
            } else if (domain.type === DomainTypes.BOOLEAN || domain.type === DomainTypes.CATEGORICAL) {
                newXConfigFlat[parameterId] = this._calculateNextCategoricalValue(
                    previousX,
                    gradientDataPoints
                );
            }
        }

        return flatten.unflatten(newXConfigFlat);
    }

    private _calculateNextNumericalValue(
        parameters: GradientAscentParameters,
        currentValue: number,
        gradientDataPoints: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[],
        domain: Domain
    ): number {
        // FIXED: Sort in descending order to get maximum performance
        const bestDataPoint = gradientDataPoints.sort((a, b) => {
            const perfA = a.data.outputs.performance ?? -Infinity;
            const perfB = b.data.outputs.performance ?? -Infinity;
            return perfB - perfA; // Descending order
        })[0];

        const slope = bestDataPoint?.data?.outputs?.slope ?? 0;
        return this._boundStep(parameters, currentValue, slope, domain);
    }

    private _calculateNextCategoricalValue(
        previousX: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>,
        gradientDataPoints: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[]
    ): any {
        // FIXED: Sort in descending order to get maximum performance
        const bestDataPoint = gradientDataPoints.sort((a, b) => {
            const perfA = a.data.outputs.performance ?? -Infinity;
            const perfB = b.data.outputs.performance ?? -Infinity;
            return perfB - perfA; // Descending order
        })[0];

        const previousPerformance = previousX.data.outputs.performance ?? -Infinity;
        const bestPerformance = bestDataPoint?.data.outputs.performance ?? -Infinity;

        // If no best data point found, keep current value from previousX
        if (!bestDataPoint) {
            return previousX.data.outputs.configuratorParameterValue;
        }

        // Only switch if the new category performs better
        if (bestPerformance > previousPerformance && bestDataPoint.data.outputs.configuratorParameterValue !== undefined) {
            return bestDataPoint.data.outputs.configuratorParameterValue;
        }

        // Otherwise keep current value
        const previousXConfigFlat = flatten(previousX.data.inputs.data);
        return previousXConfigFlat[bestDataPoint.id];
    }

    // ============================================================================
    // PRIVATE METHODS - Convergence Testing
    // ============================================================================

    private _testConvergence(
        parameters: GradientAscentParameters,
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>
    ): { converged: boolean; modulo: number } {
        const parameterDomains = this._getParameterDomains(parameters);
        let moduloSquared: number = 0;

        for (const dataPoint of state.optimiserData.dataPoints) {
            if (dataPoint.id === "x") continue;

            const domain = parameterDomains[dataPoint.id];
            if (!domain?.optimise) continue;

            if ((domain.type === DomainTypes.CONTINUOUS || domain.type === DomainTypes.DISCRETE) && domain.optimise) {
                const slope = dataPoint.data.outputs.slope;
                const xPlusDelta = dataPoint.data.outputs.xPlusDelta;
                const xDelta = dataPoint.data.outputs.xDelta;

                if (slope === undefined || xPlusDelta === undefined || xDelta === undefined) continue;

                // Calculate original x value
                const x = xPlusDelta - xDelta;

                // Only contribute to gradient if not at max boundary with positive slope
                // (if at max and slope is positive, we can't ascend further)
                if (!(x === domain.max && slope > 0)) {
                    moduloSquared += slope ** 2;
                }
            } else if (domain.type === DomainTypes.BOOLEAN || domain.type === DomainTypes.CATEGORICAL) {
                const performanceDelta = dataPoint.data.outputs.performanceDelta;

                if (performanceDelta === undefined) continue;

                // FIXED: Square the performance delta for consistency with numerical domains
                if (performanceDelta > 0) {
                    moduloSquared += performanceDelta ** 2;
                }
            }
        }

        const modulo = Math.sqrt(moduloSquared);
        return {
            converged: modulo < parameters.iterations.tolerance,
            modulo: modulo
        };
    }

    // ============================================================================
    // PRIVATE METHODS - Utility Functions
    // ============================================================================

    private _getParameterDomains(parameters: GradientAscentParameters): { [key: string]: Domain } {
        return Object.fromEntries(
            parameters.parameterSpace.map((parameter) => [parameter.id, parameter.domain])
        );
    }

    private _getXDataPoint(
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>
    ): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput> {
        const xDataPoint = state.optimiserData.dataPoints.find((dp) => dp.id === "x");
        if (!xDataPoint) {
            throw new Error("Could not find x data point in optimiser state");
        }
        return xDataPoint;
    }

    private _boundStep(parameters: GradientAscentParameters, x: number, slope: number, domain: Domain): number {
        if (domain.type !== DomainTypes.DISCRETE && domain.type !== DomainTypes.CONTINUOUS) {
            throw new Error("Bound step can only be performed on numerical parameters");
        }

        let step = slope * parameters.iterations.learningRate;

        // Clamp step magnitude to a fraction of the parameter range to prevent overshooting
        if (domain.optimise) {
            const range = domain.max - domain.min;
            const fraction = parameters.iterations.maxStepFraction ?? 0.05;
            const maxStep = fraction * range;
            step = Math.max(-maxStep, Math.min(maxStep, step));
        }

        let value = x + step;

        // Round if discrete
        if (domain.type === DomainTypes.DISCRETE) {
            value = Math.round(value);
        }

        // Apply bounds (type guard ensures min/max exist)
        if (domain.optimise) {
            value = Math.max(domain.min, Math.min(domain.max, value));
        }

        return value;
    }

    private _boundRandom(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    private _createDataPoint(
        id: string,
        configParams: C1ConfiguratorParamData,
        outputs: GradientAscentOutput = {} as GradientAscentOutput
    ): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput> {
        return {
            id: id,
            data: {
                inputs: {
                    modelName: this._model.name,
                    configuratorName: this._configuratorName,
                    multipleOrgConfigs:
                        configParams.matrixInit.incentive === C1MatrixInitTypes.RANDOM ||
                        configParams.matrixInit.influence === C1MatrixInitTypes.RANDOM ||
                        configParams.matrixInit.judgment === C1MatrixInitTypes.RANDOM ||
                        configParams.matrixInit.judgment === C1MatrixInitTypes.HYBRID ||
                        configParams.matrixInit.influence === C1MatrixInitTypes.HYBRID ||
                        configParams.matrixInit.incentive === C1MatrixInitTypes.HYBRID,
                    data: configParams,
                    hash: new ObjectHash(configParams).toString()
                },
                outputs: outputs
            },
            status: States.PENDING
        };
    }

    private _getRandomInit(parameters: GradientAscentParameters): C1ConfiguratorParamData {
        const parameterDomains = this._getParameterDomains(parameters);
        const randomInit: any = {};

        for (const [key, domain] of Object.entries(parameterDomains)) {
            if (!domain.optimise) {
                randomInit[key] = domain.default;
                continue;
            }

            switch (domain.type) {
                case DomainTypes.DISCRETE:
                    if (domain.optimise) {
                        randomInit[key] = Math.floor(Math.random() * (domain.max - domain.min + 1)) + domain.min;
                    }
                    break;
                case DomainTypes.CONTINUOUS:
                    if (domain.optimise) {
                        randomInit[key] = this._boundRandom(domain.min, domain.max);
                    }
                    break;
                case DomainTypes.BOOLEAN:
                    randomInit[key] = Math.random() < 0.5;
                    break;
                case DomainTypes.CATEGORICAL:
                    if (domain.optimise) {
                        if (!domain.categories || domain.categories.length === 0) {
                            throw new Error(`Parameter ${key} is categorical but has no categories defined`);
                        }
                        randomInit[key] = domain.categories[Math.floor(Math.random() * domain.categories.length)];
                    }
                    break;
            }
        }

        return flatten.unflatten(randomInit);
    }

    protected _validateConfiguratorParamData(
        parameters: GradientAscentParameters,
        configuratorParamData: C1ConfiguratorParamData
    ): void {
        const parameterDomains = this._getParameterDomains(parameters);
        const configFlat = flatten(configuratorParamData);

        for (const [key, domain] of Object.entries(parameterDomains)) {
            if (!domain.optimise) continue;

            if ((domain.type === DomainTypes.CONTINUOUS || domain.type === DomainTypes.DISCRETE) && domain.optimise) {
                const value = configFlat[key];
                if (typeof value !== 'number' || value < domain.min || value > domain.max) {
                    throw new Error(`Parameter ${key} value ${value} is out of range [${domain.min}, ${domain.max}]`);
                }
            }
        }
    }
}
