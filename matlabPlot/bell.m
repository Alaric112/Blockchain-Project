% Bell-Shaped Reward Function Visualization in MATLAB

% Parameters (tweak these!)
R_max = 1.0;        % Maximum reward at the peak
mu    = 48;         % Time (hours) at which reward peaks
sigma = 12;         % Controls width of the peak

% Time axis: from 0 to, say, twice the peak time
delta = linspace(0, 2*mu, 500);

% Example normalized usefulness values
usefulness = [1.0, 0.5, 0.2];

% Prepare figure
figure;
hold on;

% Plot one curve per usefulness level
colors = lines(numel(usefulness));
for i = 1:numel(usefulness)
    u = usefulness(i);
    T = exp(-((delta - mu).^2) / (2 * sigma^2));   % Gaussian time factor
    R = R_max * u .* T;                             % Full reward curve
    plot(delta, R, 'Color', colors(i,:), 'LineWidth', 2, ...
         'DisplayName', sprintf('u = %.1f', u));
end

% Annotate
xlabel('Time Since Publication (\Delta, hours)');
ylabel('Normalized Reward R(\Delta)');
title('Bell-Shaped Reward Function');
legend('Location','best');
grid on;
hold off;

%%
%% Visibility Decay Visualization
% V_i = S ./ ((t + 1).^alpha)

% Example parameters
S = 100;                     % example net score 
alphas = [0.8, 1.2, 1.8];    % decay exponents to compare

% Time axis in months (0 to 12)
t = linspace(0, 12, 500);

% Plot
figure;
hold on;
for k = 1:numel(alphas)
    alpha = alphas(k);
    V = S ./ ((t + 1).^alpha);
    plot(t, V, 'LineWidth', 2, ...
         'DisplayName', sprintf('\\alpha = %.1f', alpha));
end
xlabel('Age of Review (months)');
ylabel('Visibility Score V_i');
title('Time‑Decay of Review Visibility');
legend('Location','best');
grid on;
hold off;


%% Gaussian Reward Curve Visualization
% w(j) = exp(-((j - mu).^2) / (2 * sigma^2))

% Example parameters
mu_vals    = [1, 2, 3];     % peak months
sigma_vals = [0.5, 1, 2];   % spreads

% Month axis (0 to 12)
j = linspace(0, 12, 500);

% Plot
figure;
hold on;
for k = 1:numel(mu_vals)
    mu    = mu_vals(k);
    sigma = sigma_vals(k);
    w = exp(-((j - mu).^2) ./ (2 * sigma^2));
    plot(j, w, 'LineWidth', 2, ...
         'DisplayName', sprintf('\\mu = %.1f, \\sigma = %.1f', mu, sigma));
end
xlabel('Months Since Publication j');
ylabel('Normalized Reward Weight w_i(j)');
title('Bell‑Shaped Reward Curve over Time');
legend('Location','best');
grid on;
hold off;
