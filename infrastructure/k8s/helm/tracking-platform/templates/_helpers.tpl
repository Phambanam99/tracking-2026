{{- define "tracking-platform.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "tracking-platform.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "tracking-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "tracking-platform.componentName" -}}
{{- $root := .root -}}
{{- $component := .component -}}
{{- printf "%s-%s" (include "tracking-platform.fullname" $root) $component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "tracking-platform.configMapName" -}}
{{- if .Values.config.existingConfigMap -}}
{{- .Values.config.existingConfigMap -}}
{{- else -}}
{{- printf "%s-config" (include "tracking-platform.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "tracking-platform.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "tracking-platform.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "tracking-platform.httpProbe" -}}
httpGet:
  path: {{ default "/actuator/health" .path }}
  port: http
periodSeconds: {{ default 10 .periodSeconds }}
timeoutSeconds: {{ default 3 .timeoutSeconds }}
failureThreshold: {{ default 3 .failureThreshold }}
{{- if .successThreshold }}
successThreshold: {{ .successThreshold }}
{{- end }}
{{- if .initialDelaySeconds }}
initialDelaySeconds: {{ .initialDelaySeconds }}
{{- end }}
{{- end -}}
