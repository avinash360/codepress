<template>
  <div class="StepContainer" 
    :class="{ 'StepContainer--selected': isSelected, 'StepContainer--failed': step.result === 'failed', 'StepContainer--passed': step.result === 'passed' }"
    @click="handleSelectStep(step)">
    
    <div class="StepWrapper StepWrapper--indent2" v-if="isMetaStep(step)">
      <MetaStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent1" v-else-if="isCommentStep(step)">
      <CommentStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameIncludes('send')">
      <SendStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('switchTo')">
      <SwitchToStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('scroll')">
      <ScrollStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('wait')">
      <WaitStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('click')">
      <ClickStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('fillField')">
      <FillFieldStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('select')">
      <SelectOptionStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('see')">
      <SeeStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('dontSee')">
      <DontSeeStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('amOnPage')">
      <AmOnPageStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameIncludes('Cookie')">
      <CookieStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('refresh')">
      <RefreshPageStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('press')">
      <PressStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('execute')">
      <ExecuteStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('grab')">
      <GrabStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('comment')">
      <CommentStep :step="step" />
    </div>

    <div class="StepWrapper StepWrapper--indent3" v-else-if="stepNameStartsWith('saveScreenshot')">
      <SaveScreenshotStep :step="step" />
    </div>

    <div v-else class="StepWrapper StepWrapper--indent3">
      <div class="GenericStep columns is-gapless">
        <div class="column is-3">
          I {{step.humanized}}
        </div>
        <div class="column is-9 ellipsize">
          <span class="Step-argSelector">{{getSelectorLabel(step.args)}}</span>
          &nbsp;
          <span class="Step-argOther" v-if="step.args[1]">{{toStringOrNumber(step.args[1])}}</span>
        </div>
      </div>
    </div>

    <div class="StepHoverContainer" v-if="isHovered">
      <div class="StepHoverContainer-content is-pulled-right has-background-white">
        <span class="has-text-grey-light">
          <i class="far fa-clock"></i> {{step.at / 1000}}s
        </span>
        <span v-if="step.duration" class="has-text-grey-light">
          <i class="fas fa-stopwatch has-text-grey-light"></i> {{step.duration}}ms
        </span>
        
        <button v-if="step.stack.stackFrameOfStep && step.stack.stackFrameOfStep !== step.stack.stackFrameInTest" 
          class="button is-small is-info is-outlined"
          @click="openFileFromStack(step.stack.stackFrameOfStep)"
        >
          <i class="fas fa-link"></i> {{getMethodFromStack(step.stack.stackFrameOfStep)}}
        </button>
        <button v-if="step.stack.stackFrameInTest" 
          class="button is-small is-info is-outlined" 
          href="#" 
          v-on:click="openFileFromStack(step.stack.stackFrameInTest)">
          <i class="fas fa-link"></i> Scenario
        </button>
        <button v-if="isAction(step)" class="button is-small is-outlined has-text-grey" @click="copySelectorToClipboard(step)">
          <i class="fas fa-copy"></i> Selector
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import {getSelectorString} from '../services/selector';

import SendStep from './steps/SendStep';
import SeeStep from './steps/SeeStep';
import DontSeeStep from './steps/DontSeeStep';
import WaitStep from './steps/WaitStep';
import ClickStep from './steps/ClickStep';
import AmOnPageStep from './steps/AmOnPageStep';
import CookieStep from './steps/CookieStep';
import PressStep from './steps/PressStep';
import RefreshPageStep from './steps/RefreshPageStep';
import SaveScreenshotStep from './steps/SaveScreenshotStep';
import FillFieldStep from './steps/FillFieldStep';
import SelectOptionStep from './steps/SelectOptionStep';
import ExecuteStep from './steps/ExecuteStep';
import GrabStep from './steps/GrabStep';
import CommentStep from './steps/CommentStep';
import SwitchToStep from './steps/SwitchToStep';
import ScrollStep from './steps/ScrollStep';
import MetaStep from './steps/MetaStep';

import copyToClipboard from 'copy-text-to-clipboard';

export default {
  name: 'Step',
  props: ['step', 'selectedStep', 'isHovered', 'isSelected', 'error'],
  components: {
    SendStep,
    SeeStep,
    DontSeeStep,
    WaitStep,
    ClickStep,
    AmOnPageStep,
    CookieStep,
    PressStep,
    RefreshPageStep,
    SaveScreenshotStep,
    FillFieldStep,
    SelectOptionStep,
    ExecuteStep,
    GrabStep,
    CommentStep,
    SwitchToStep,
    ScrollStep,
    MetaStep
  },
  methods: {
    isAction(step) {
      return ['click', 'clickLink', 'fillField', 'selectOption'].includes(step.name);
    },

    copySelectorToClipboard(step) {
      copyToClipboard(this.getSelectorValue(step.args));
    },

    isMetaStep(step) {
      return step.type === 'meta';
    },

    isCommentStep(step) {
      return step.type === 'comment';
    },

    stepNameStartsWith(methodName) {
      const step = this.$props.step;
      return step.name.startsWith(methodName);
    },

    stepNameIncludes(methodName) {
      const step = this.$props.step;
      return step.name.includes(methodName);
    },

    getSelectorLabel: function (stepArgs) {
      const {label} = getSelectorString(stepArgs[0]);
      return label;
    },

    getSelectorValue: function (stepArgs) {
      const {value} = getSelectorString(stepArgs[0]);
      return value;
    },

    toStringOrNumber: function (stringOrNumber) {
      if (typeof stringOrNumber === 'number') return stringOrNumber;
      return `"${stringOrNumber}"`
    },

    getMethodFromStack: function (stackFrame) {
      if (!stackFrame) return '<stackframe not available>'
      const m = stackFrame.match(/at\s+([^\s]+)/)
      if (!m) return;
      return m[1];
    },

    openFileFromStack: function (stackFrame) {
      const m = stackFrame.match(/\s+\(([^)]+)/)
      if (m) {
        const filePath = m[1];
        axios.get(`/api/tests/${encodeURIComponent(filePath)}/open`);
      }
    },

    handleSelectStep: function (step) {
      if (this.isMetaStep(step)) return;
      this.$emit('select-step', step)
    }
  }
}
</script>

<style lang="scss" scoped>
.StepContainer {
  position: relative;
  cursor: pointer;
  font-size: 0.9rem;
  font-family:  Inconsolata, monospace; 
}

.StepContainer--selected {
  background-color: #ddd;
}

.StepContainer--passed {
  border-left: 4px solid hsl(141, 71%, 48%);
}

.StepContainer--failed {
  border-left: 4px solid hsl(348, 100%, 61%);
}

.StepHoverContainer {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  line-height: 1.5em;
  z-index: 99999;

}

.StepHoverContainer-content {
  padding: 3px;
  box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23);
  border-radius: 3px;
}

.StepHoverContainer-content > button {
  margin-left: .2rem;
}

.StepWrapper {
  padding: .2em 0 .2em 0;
}
.StepWrapper--indent1 {
  padding-left: .4em;
}
.StepWrapper--indent2 {
  padding-left: .8em;
}
.StepWrapper--indent3 {
  padding-left: 1.2em;
}

.GenericStep {
}

.Step-argSelector {
  color: hsl(204, 86%, 53%);
}

.Step-argOther {
  color:hsl(171, 100%, 41%)
}

.StepDetails {
  width: 10em;
  font-size: 0.8rem;
  font-family:  Inconsolata, monospace;
  line-height: 2em;
  background-color: white;
  z-index: 10;
}


</style>
