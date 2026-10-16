package io.beyonddestination.game;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Native package/asset smoke only; not a substitute for the shared gameplay/device checklist. */
@RunWith(AndroidJUnit4.class)
public class PackageIdentityTest {
    @Test
    public void packagesTheSharedGame() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("io.beyonddestination.game", context.getPackageName());
        assertEquals("Beyond Destination", context.getString(R.string.app_name));
        StringBuilder html = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                context.getAssets().open("public/index.html"), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) html.append(line);
        }
        assertTrue(html.toString().contains("gameCanvas"));
        assertTrue(html.toString().contains("touchControls"));
    }
}
