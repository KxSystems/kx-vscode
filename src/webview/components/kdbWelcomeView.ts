/*
 * Copyright (c) 1998-2025 KX Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

/* c8 ignore start */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { kdbStyles, shoelaceStyles } from "./styles";

@customElement("kdb-welcome-view")
export class KdbWelcomeView extends LitElement {
  static readonly styles = [
    shoelaceStyles,
    kdbStyles,
    css`
      .container {
        padding: 1em 4em 0 4em;
        margin-bottom: 4em;
      }
      .row {
        display: flex;
        flex-wrap: nowrap;
        flex-direction: column;
        gap: 0;
      }
      .col {
        display: flex;
        flex-wrap: nowrap;
        flex-direction: row;
      }
      .gap-1 {
        gap: 1em;
      }
      .mt-1 {
        margin-top: 1em;
      }
      .middle {
        align-items: baseline;
      }
      .nowrap {
        white-space: nowrap;
      }
      .icon {
        margin-top: 0.15em;
      }
      .icon-inline {
        margin-left: 0.25em;
        margin-right: 0.25em;
      }
      .footer {
        position: fixed;
        bottom: 0;
        padding: 1em;
        width: 100%;
        text-align: center;
        background-color: var(--vscode-editor-background);
      }
      a {
        color: var(--vscode-textLink-foreground);
        text-decoration: none;
      }
      img {
        width: 100%;
        height: auto;
        display: block;
        max-width: 35em;
      }
    `,
  ];

  @property()
  image = "";

  @property()
  dark = "";

  @property()
  checked = "true";

  readonly vscode = acquireVsCodeApi();

  protected render() {
    return html`
      <div class="container">
        <div class="row">
          <h1>Welcome to KDB-X</h1>
          <div class="col gap-1">
            <div>
              <p>
                KDB-X is the next generation of kdb+, optimized for modern
                analytics and AI workflows. Let’s get you ready to code.
              </p>
              <p>What you’ll do next:</p>
              <div class="col">
                <div class="icon">${renderIcon1(this.dark)}</div>
                <div class="row">
                  <strong>Sign in or create an account</strong>
                  <div>
                    A browser opens → enter email → verify with code → accept
                    EULA.
                  </div>
                </div>
              </div>
              <div class="col">
                <div class="icon">${renderIcon2(this.dark)}</div>
                <div class="row">
                  <strong>Retrieve your license key</strong>
                  <div>Copy the key from the KDB-X welcome page.</div>
                </div>
              </div>
              <div class="col">
                <div class="icon">${renderIcon3(this.dark)}</div>
                <div class="row">
                  <strong>Activate in VS Code</strong>
                  <div>
                    Paste the key in the extension → terminal installs KDB-X
                    runtime.
                  </div>
                </div>
              </div>
              <div class="col">
                <div class="icon">${renderIcon4(this.dark)}</div>
                <div class="row">
                  <strong>Start coding</strong>
                  <div>
                    Installation completes → switch to KX Extension tab.
                  </div>
                </div>
              </div>
              <div class="col mt-1 middle">
                <sl-button
                  variant="primary"
                  href="https://developer.kx.com/products/kdb-x/install"
                  @click="${() => {
                    this.vscode.postMessage("install");
                  }}"
                  >Install & Continue</sl-button
                >
                <a href="https://developer.kx.com/products/kdb-x" class="nowrap"
                  >Developer Center & Documentation
                  <span class="icon-inline">${renderIcon5()}</span></a
                >
              </div>
            </div>
            <div class="middle"><img src="${this.image}" /></div>
          </div>
        </div>
      </div>
      <div class="footer">
        <sl-checkbox
          .checked="${this.checked === "true"}"
          @sl-change="${(event: Event) => {
            this.vscode.postMessage((event.target as any).checked);
          }}"
          >Show welcome page on startup</sl-checkbox
        >
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-welcome-view": KdbWelcomeView;
  }
}

function renderIcon1(dark = "") {
  return html`
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.66602 9.33333C4.29935 9.33333 3.98546 9.20278 3.72435 8.94167C3.46324 8.68056 3.33268 8.36667 3.33268 8C3.33268 7.63333 3.46324 7.31944 3.72435 7.05833C3.98546 6.79722 4.29935 6.66667 4.66602 6.66667C5.03268 6.66667 5.34657 6.79722 5.60768 7.05833C5.86879 7.31944 5.99935 7.63333 5.99935 8C5.99935 8.36667 5.86879 8.68056 5.60768 8.94167C5.34657 9.20278 5.03268 9.33333 4.66602 9.33333ZM4.66602 12C3.5549 12 2.61046 11.6111 1.83268 10.8333C1.0549 10.0556 0.666016 9.11111 0.666016 8C0.666016 6.88889 1.0549 5.94444 1.83268 5.16667C2.61046 4.38889 3.5549 4 4.66602 4C5.41046 4 6.08546 4.18333 6.69102 4.55C7.29657 4.91667 7.77713 5.4 8.13268 6H13.9993L15.9993 8L12.9993 11L11.666 10L10.3327 11L8.91601 10H8.13268C7.77713 10.6 7.29657 11.0833 6.69102 11.45C6.08546 11.8167 5.41046 12 4.66602 12ZM4.66602 10.6667C5.28824 10.6667 5.83546 10.4778 6.30768 10.1C6.7799 9.72222 7.09379 9.24444 7.24935 8.66667H9.33268L10.2993 9.35L11.666 8.33333L12.8493 9.25L14.0993 8L13.4327 7.33333H7.24935C7.09379 6.75556 6.7799 6.27778 6.30768 5.9C5.83546 5.52222 5.28824 5.33333 4.66602 5.33333C3.93268 5.33333 3.3049 5.59444 2.78268 6.11667C2.26046 6.63889 1.99935 7.26667 1.99935 8C1.99935 8.73333 2.26046 9.36111 2.78268 9.88333C3.3049 10.4056 3.93268 10.6667 4.66602 10.6667Z"
        fill="${dark ? "#CCCCCC" : "#404651"}" />
    </svg>
  `;
}

function renderIcon2(dark = "") {
  return html`
    <svg
      width="14"
      height="13"
      viewBox="0 0 14 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.479661 2.76566e-05H13.493L13.973 0.480027V12.48L13.493 12.96H0.479661L-0.000338554 12.48V0.480027L0.479661 2.76566e-05ZM1.01299 4.00003V12H13.013V4.00003H1.01299ZM1.01299 2.98669H13.013V0.960028H1.01299V2.98669Z"
        fill="${dark ? "#CCCCCC" : "#404651"}" />
    </svg>
  `;
}

function renderIcon3(dark = "") {
  return html`
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0_16030_1123)">
        <mask
          id="mask0_16030_1123"
          style="mask-type:luminance"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="16"
          height="16">
          <path d="M16 0H0V16H16V0Z" fill="white" />
        </mask>
        <g mask="url(#mask0_16030_1123)">
          <g filter="url(#filter0_d_16030_1123)">
            <mask
              id="mask1_16030_1123"
              style="mask-type:alpha"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="16"
              height="16">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M11.3459 15.9316C11.5979 16.0303 11.8852 16.024 12.1396 15.9009L15.4337 14.3077C15.7798 14.1404 16 13.7882 16 13.4019V2.59828C16 2.21196 15.7798 1.85981 15.4337 1.69239L12.1396 0.0990508C11.8058 -0.0623987 11.4151 -0.0228617 11.1222 0.191243C11.0803 0.221818 11.0404 0.255976 11.003 0.293604L4.69682 6.07673L1.94995 3.98081C1.69426 3.78572 1.33658 3.8017 1.0991 4.01885L0.218083 4.82441C-0.0724164 5.09004 -0.0727331 5.5494 0.217367 5.81546L2.59954 8.00003L0.217367 10.1846C-0.0727331 10.4506 -0.0724164 10.91 0.218083 11.1756L1.0991 11.9812C1.33658 12.1983 1.69426 12.2144 1.94995 12.0192L4.69682 9.92333L11.003 15.7064C11.1028 15.8068 11.2199 15.8823 11.3459 15.9316ZM12.0024 4.34901L7.21747 8.00003L12.0024 11.651V4.34901Z"
                fill="${dark ? "#CCCCCC" : "#404651"}" />
            </mask>
            <g mask="url(#mask1_16030_1123)">
              <path
                d="M15.4338 1.69512L12.1371 0.0995753C11.7555 -0.0851106 11.2994 -0.00720879 11 0.293827L0.207733 10.1848C-0.0825508 10.4509 -0.0822175 10.9102 0.208448 11.1759L1.09 11.9814C1.32763 12.1986 1.68552 12.2145 1.94136 12.0195L14.9377 2.10904C15.3737 1.77656 16 2.08915 16 2.63926V2.6008C16 2.21464 15.7798 1.86264 15.4338 1.69512Z"
                fill="${dark ? "#CCCCCC" : "#404651"}" />
              <g filter="url(#filter1_d_16030_1123)">
                <path
                  d="M15.4338 14.3052L12.1371 15.9008C11.7555 16.0855 11.2994 16.0076 11 15.7065L0.207733 5.81547C-0.0825508 5.54944 -0.0822175 5.09005 0.208448 4.82443L1.09 4.01888C1.32763 3.80173 1.68552 3.78574 1.94136 3.98085L14.9377 13.8913C15.3737 14.2238 16 13.9112 16 13.361V13.3996C16 13.7857 15.7798 14.1377 15.4338 14.3052Z"
                  fill="${dark ? "#CCCCCC" : "#404651"}" />
              </g>
              <g filter="url(#filter2_d_16030_1123)">
                <path
                  d="M12.1372 15.9009C11.7555 16.0856 11.2995 16.0075 11 15.7064C11.369 16.0773 12 15.8147 12 15.2901V0.709954C12 0.185383 11.369 -0.0773393 11 0.293607C11.2995 -0.00746229 11.7555 -0.0854646 12.1372 0.0990536L15.4333 1.69239C15.7797 1.85981 16 2.21196 16 2.59828V13.4019C16 13.7882 15.7797 14.1402 15.4333 14.3077L12.1372 15.9009Z"
                  fill="${dark ? "#CCCCCC" : "#404651"}" />
              </g>
              <g style="mix-blend-mode:overlay" opacity="0.25">
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M11.3361 15.9317C11.5881 16.0304 11.8755 16.0241 12.1298 15.901L15.424 14.3078C15.7702 14.1405 15.9902 13.7883 15.9902 13.402V2.59839C15.9902 2.21208 15.7702 1.85996 15.424 1.69252L12.1298 0.0991676C11.796 -0.0622818 11.4054 -0.0227276 11.1124 0.191361C11.0705 0.221951 11.0307 0.256093 10.9933 0.293721L4.68705 6.07685L1.94017 3.98093C1.68447 3.78583 1.32681 3.80181 1.08933 4.01896L0.208312 4.82452C-0.0821716 5.09015 -0.0825052 5.54952 0.207595 5.81557L2.58975 8.00013L0.207595 10.1847C-0.0825052 10.4508 -0.0821716 10.9101 0.208312 11.1757L1.08933 11.9813C1.32681 12.1985 1.68447 12.2144 1.94017 12.0193L4.68705 9.92344L10.9933 15.7065C11.093 15.8069 11.2102 15.8825 11.3361 15.9317ZM11.9927 4.34912L7.20769 8.00013L11.9927 11.6511V4.34912Z"
                  fill="${dark ? "#CCCCCC" : "#404651"}" />
              </g>
            </g>
          </g>
        </g>
      </g>
      <defs>
        <filter
          id="filter0_d_16030_1123"
          x="-6.25"
          y="-4.16667"
          width="28.5"
          height="28.5"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha" />
          <feOffset dy="2.08333" />
          <feGaussianBlur stdDeviation="3.125" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0" />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_16030_1123" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_16030_1123"
            result="shape" />
        </filter>
        <filter
          id="filter1_d_16030_1123"
          x="-8.34311"
          y="-4.48874"
          width="32.6764"
          height="28.8221"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha" />
          <feOffset />
          <feGaussianBlur stdDeviation="4.16667" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend
            mode="overlay"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_16030_1123" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_16030_1123"
            result="shape" />
        </filter>
        <filter
          id="filter2_d_16030_1123"
          x="2.66666"
          y="-8.33334"
          width="21.6667"
          height="32.6668"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha" />
          <feOffset />
          <feGaussianBlur stdDeviation="4.16667" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend
            mode="overlay"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_16030_1123" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_16030_1123"
            result="shape" />
        </filter>
        <clipPath id="clip0_16030_1123">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  `;
}

function renderIcon4(dark = "") {
  return html`
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.15858 11.2803H6.95819L12.1864 6.05063L11.3868 5.2601L6.52763 10.0641L4.31331 7.87495L3.5137 8.66548L6.15858 11.2803ZM8.80346 0.0304052C9.70559 0.0709454 10.5667 0.293917 11.3868 0.699319C12.248 1.10472 13.0066 1.63175 13.6627 2.28039C15.2209 3.94254 16 5.88847 16 8.11819C16 9.86142 15.3849 11.5236 14.1547 13.1046C13.5396 13.8344 12.8425 14.4425 12.0634 14.929C11.2843 15.3749 10.4437 15.6789 9.54157 15.8411C7.57328 16.206 5.78952 15.9425 4.19029 15.0506C3.37017 14.6046 2.65257 14.0371 2.03748 13.3479C1.42239 12.6587 0.950825 11.8884 0.622777 11.0371C0.29473 10.1857 0.0897005 9.29385 0.00768861 8.36143C-0.0333173 7.429 0.0897004 6.53712 0.376742 5.68577C0.991831 3.82092 2.07849 2.38174 3.63671 1.36823C4.37482 0.88175 5.17444 0.516888 6.03556 0.273647C6.93769 0.0304052 7.86032 -0.0506753 8.80346 0.0304052ZM9.41855 14.7465C10.9768 14.3817 12.2685 13.5709 13.2936 12.3141C14.3188 10.9357 14.7903 9.49656 14.7083 7.99657C14.7083 7.06414 14.5238 6.17226 14.1547 5.32091C13.8267 4.46956 13.3551 3.71957 12.74 3.07092C11.5509 1.89526 10.1772 1.24661 8.61893 1.12499C7.83982 1.08445 7.06071 1.16553 6.28159 1.36823C5.50248 1.53039 4.80538 1.83445 4.19029 2.28039C2.8781 3.25336 1.97597 4.53037 1.4839 6.11144C1.03284 7.69251 1.13535 9.21277 1.79145 10.6722C2.48855 12.1317 3.5342 13.2465 4.9284 14.0168C5.58449 14.4222 6.3021 14.6857 7.08121 14.8073C7.86032 14.929 8.63944 14.9087 9.41855 14.7465Z"
        fill="${dark ? "#CCCCCC" : "#404651"}" />
    </svg>
  `;
}

function renderIcon5() {
  return html`
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 8H1V1H4.5V0H1C0.445 0 0 0.45 0 1V8C0 8.55 0.445 9 1 9H8C8.55 9 9 8.55 9 8V4.5H8V8ZM5.5 0V1H7.295L2.38 5.915L3.085 6.62L8 1.705V3.5H9V0H5.5Z"
        fill="currentColor" />
    </svg>
  `;
}

/* c8 ignore end */
