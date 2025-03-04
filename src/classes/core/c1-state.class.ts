import { Utils, State } from "aethon-arion-pipeline";

export class StateAction extends State {
    outputTensor: number[] = Utils.tensor([1]) as number[];
    constructor() {
        super();
    }
    emit(): number[] {
        return this.outputTensor;
    }
}

export class StateSelf extends State {
    outputTensor: number[] = Utils.tensor([0]) as number[];
    constructor() {
        super();
    }
    emit(): number[] {
        return this.outputTensor;
    }
}
