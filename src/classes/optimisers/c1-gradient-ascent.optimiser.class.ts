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

export class C1GradientAscentOptimiser extends GradientAscentOptimiser<
    C1ConfiguratorParamData,
    GradientAscentParameters,
    GradientAscentOptimiserData<C1ConfiguratorParamData>
> {
    private _configuratorName: string;

    constructor(model: C1Model) {
        super(C1OptimiserNames.GRADIENT_ASCENT, model);
        this._configuratorName = C1ConfiguratorNames.BASE;
    }

    initialise(
        parameters: GradientAscentParameters,
        simSetDTO: SimSetDTO
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        return this._createInitialState(parameters, simSetDTO);
    }

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

        let value = x + slope * parameters.iterations.learningRate;

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
