import { C1GradientAscentOptimiserName } from "../../constants/c1.model.constants";
import { C1ConfiguratorParamData, C1OptimiserDerivativeStepSize, C1ParamSpaceDefinition } from "../../interfaces/c1.interfaces";
import {
    GradientAscentOptimiser,
    Model,
    Gradient,
    GradientAscentPartialDerivativeDTO,
    GradientAscentParameterDTO,
    OptimiserStateDTO,
    States,
    GradientAscentOptimiserStateData,
    ObjectHash
} from "aethon-arion-pipeline";
import { C1ConfiguratorInitType } from "../../types/c1.types";

export class C1GradientAscentOptimiser extends GradientAscentOptimiser<
    C1ConfiguratorParamData,
    GradientAscentParameterDTO<C1ParamSpaceDefinition, C1OptimiserDerivativeStepSize>,
    GradientAscentOptimiserStateData<C1ConfiguratorParamData>
> {
    private graphMappings = {
        teams: 0,
        "top-down": 1
    };

    constructor(
        model: Model<
            C1ConfiguratorParamData,
            GradientAscentParameterDTO<C1ParamSpaceDefinition, C1OptimiserDerivativeStepSize>,
            GradientAscentOptimiserStateData<C1ConfiguratorParamData>
        >,
        parameters: GradientAscentParameterDTO<C1ParamSpaceDefinition, C1OptimiserDerivativeStepSize>
    ) {
        super(C1GradientAscentOptimiserName, model, parameters);
    }

    step(
        state?: OptimiserStateDTO<GradientAscentOptimiserStateData<C1ConfiguratorParamData>>
    ): OptimiserStateDTO<GradientAscentOptimiserStateData<C1ConfiguratorParamData>> {
        if (state && state.optimiserData && state.optimiserData.gradient) {
            // check that all partial derivatives have been calculated
            // otherwise throw an error
            for (let partialDerivative of state.optimiserData.gradient) {
                if (partialDerivative.status !== States.COMPLETED)
                    throw new Error("The partial derivatives have not been calculated");
            }
            // all partial derivatives have been calculated, therefore we can proceed
            // calculate the next point and establish the partial derivative dxs

            return {} as OptimiserStateDTO<GradientAscentOptimiserStateData<C1ConfiguratorParamData>>;
        } else {
            const tmp: OptimiserStateDTO<GradientAscentOptimiserStateData<C1ConfiguratorParamData>> =
                {} as OptimiserStateDTO<GradientAscentOptimiserStateData<C1ConfiguratorParamData>>;

            tmp.modelName = this.model.name;
            tmp.optimiserName = this.name;
            tmp.status = States.PENDING;
            // first pick a random configuration within the configuration parameter space
            const x: C1ConfiguratorParamData = this._getRandomInit({
                influence: "purposeful",
                judgment: "random",
                incentive: "purposeful"
            });
            tmp.optimiserData = {
                x: x,
                hash: new ObjectHash(x).toString(),
                gradient: this._getGradient(x)
            } as GradientAscentOptimiserStateData<C1ConfiguratorParamData>;
            return tmp;
        }
    }

    private _getRandomInit(matrixInit: {
        influence: C1ConfiguratorInitType;
        judgment: C1ConfiguratorInitType;
        incentive: C1ConfiguratorInitType;
    }): C1ConfiguratorParamData {
        if (this._parameters && this._parameters.parameterSpaceDefinition) {
            // return a random point in the parameter space
            const randomInit = {} as C1ConfiguratorParamData;
            randomInit.spans = Math.floor(
                this._boundRandom(
                    this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MAX]
                )
            );
            randomInit.layers = Math.floor(
                this._boundRandom(
                    this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MAX]
                )
            );
            randomInit.gains = {
                influence: this._boundRandom(
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MAX]
                ),
                judgment: this._boundRandom(
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MAX]
                ),
                incentive: this._boundRandom(
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MAX]
                )
            };
            randomInit.actionStateProbability = this._boundRandom(
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN],
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX]
            );
            Math.random() > 0.5 ? (randomInit.graph = "top-down") : (randomInit.graph = "teams");
            randomInit.board = { controlStep: false };
            randomInit.reporting = { unitPayroll: 1, unitPrice: 1 };
            randomInit.matrixInit = {
                influence: matrixInit.influence,
                judgment: matrixInit.judgment,
                incentive: matrixInit.incentive
            };
            return randomInit;
        } else {
            throw this._initError();
        }
    }

    private _getGradient(configuratorParamData: C1ConfiguratorParamData): Gradient<C1ConfiguratorParamData> {
        if (this._parameters) {
            this._validateConfiguratorParamData(configuratorParamData);
            // calculate the partial derivative along each optimisation dimension
            let del = [] as Gradient<C1ConfiguratorParamData>;

            // dx(spans)
            del.push(
                this._initPartialDerivative(
                    configuratorParamData,
                    "spans",
                    configuratorParamData.spans,
                    1,
                    this._parameters.parameterSpaceDefinition.spans
                )
            );

            // dx(layers)
            del.push(
                this._initPartialDerivative(
                    configuratorParamData,
                    "layers",
                    configuratorParamData.layers,
                    1,
                    this._parameters.parameterSpaceDefinition.layers
                )
            );

            // dx(influence)
            del.push(
                this._initPartialDerivative(
                    configuratorParamData,
                    "gains.influence",
                    configuratorParamData.gains.influence,
                    this._parameters.derivativeStepSizes.gains.influence,
                    this._parameters.parameterSpaceDefinition.gains.influence
                )
            );

            // dx(judgment)
            del.push(
                this._initPartialDerivative(
                    configuratorParamData,
                    "gains.judgment",
                    configuratorParamData.gains.judgment,
                    this._parameters.derivativeStepSizes.gains.judgment,
                    this._parameters.parameterSpaceDefinition.gains.judgment
                )
            );

            // dx(incentive)
            del.push(
                this._initPartialDerivative(
                    configuratorParamData,
                    "gains.incentive",
                    configuratorParamData.gains.incentive,
                    this._parameters.derivativeStepSizes.gains.incentive,
                    this._parameters.parameterSpaceDefinition.gains.incentive
                )
            );

            // dx(actionStateProbability)
            del.push(
                this._initPartialDerivative(
                    configuratorParamData,
                    "actionStateProbability",
                    configuratorParamData.actionStateProbability,
                    this._parameters.derivativeStepSizes.actionStateProbability,
                    this._parameters.parameterSpaceDefinition.actionStateProbability
                )
            );

            // dx(graph)

            return del;
        } else {
            throw this._initError();
        }
    }

    private _getNextPoint(
        configuratorParamData: C1ConfiguratorParamData,
        gradient: Gradient<C1ConfiguratorParamData>
    ): C1ConfiguratorParamData {
        return {} as C1ConfiguratorParamData;
    }

    private _testConvergence(gradient: Gradient<C1ConfiguratorParamData>): boolean {
        return true;
    }

    protected _initPartialDerivative(
        x: C1ConfiguratorParamData,
        valueName: string,
        initValue: any,
        stepSize: number,
        bounds: number[]
    ): GradientAscentPartialDerivativeDTO<C1ConfiguratorParamData> {
        const dx = {} as GradientAscentPartialDerivativeDTO<C1ConfiguratorParamData>;
        dx.configuratorParameterValueName = valueName;
        let tmp: number = 1;
        if (valueName !== "graph") {
            tmp = stepSize;
            if (initValue + tmp <= bounds[this._boundIndices.MAX]) tmp = 0;
            dx.configuratorParameterValue = tmp;
        }
        dx.xDelta = tmp;
        dx.xPlusDelta = initValue + tmp;
        dx.status = States.PENDING;
        dx.performance = null;
        dx.performanceDelta = null;
        dx.slope = null;

        // create the configuratorParams for the dx point
        dx.configuratorParams = JSON.parse(JSON.stringify(x));
        switch (valueName) {
            case "gains.influence":
                dx.configuratorParams.gains.influence = dx.configuratorParameterValue;
                break;
            case "gains.judgment":
                dx.configuratorParams.gains.judgment = dx.configuratorParameterValue;
                break;
            case "gains.incentive":
                dx.configuratorParams.gains.incentive = dx.configuratorParameterValue;
                break;
            default:
                dx.configuratorParams[valueName] = dx.configuratorParameterValue;
                break;
        }
        dx.hash = new ObjectHash(dx.configuratorParams).toString();
        return dx;
    }

    protected _boundRandom(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    protected _validateConfiguratorParamData(configuratorParamData: C1ConfiguratorParamData): void {
        if (this._parameters) {
            // check that the point is within the parameter space
            if (
                !this._checkRange(
                    configuratorParamData.spans,
                    this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MAX]
                )
            )
                throw new Error("The number of spans must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.layers,
                    this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MAX]
                )
            )
                throw new Error("The number of layers must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.gains.influence,
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MAX]
                )
            )
                throw new Error("The influence gain must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.gains.judgment,
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MAX]
                )
            )
                throw new Error("The judgment gain must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.gains.incentive,
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MAX]
                )
            )
                throw new Error("The incentive gain must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.actionStateProbability,
                    this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX]
                )
            )
                throw new Error("The action state probability must be within the range of the parameter space");
        } else {
            throw this._initError();
        }
    }

    protected _checkRange(value: number, min: number, max: number): boolean {
        return value >= min && value <= max;
    }

    protected _checkBounds() {
        if (this._parameters.parameterSpaceDefinition) {
            if (
                this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum span must be greater than the minimum span");
            }
            if (
                this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum layer must be greater than the minimum layer");
            }
            if (
                this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum influence gain must be greater than the minimum influence gain");
            }
            if (
                this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum judgment gain must be greater than the minimum judgment gain");
            }
            if (
                this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum incentive gain must be greater than the minimum incentive gain");
            }
            if (
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN]
            ) {
                throw new Error(
                    "The maximum action state probability must be greater than the minimum action state probability"
                );
            }
            if (
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX] <= 0 ||
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX] >= 1
            ) {
                throw new Error("The maximum action state probability must be in the range [0,1]");
            }
            if (
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN] <= 0 ||
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN] >= 1
            ) {
                throw new Error("The minimum action state probability must be in the range [0,1]");
            }
        } else {
            throw this._initError();
        }
    }

    protected _initError(): Error {
        return new Error("The optimiser has not been initialised");
    }
}
