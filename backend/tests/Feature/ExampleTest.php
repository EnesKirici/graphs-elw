<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * API kökü ana siteye 301 döner (routes/web.php) — Laravel "welcome" sayfası
     * Google'a düşmesin diye. Bu test eskiden 200 beklerdi; elwgraphs.com geçişinde
     * yönlendirme eklenince kırıldı, artık asıl davranışı doğruluyor.
     */
    public function test_the_api_root_redirects_to_the_site(): void
    {
        $response = $this->get('/');

        $response->assertStatus(301);
        $response->assertHeader('X-Robots-Tag', 'noindex');
    }
}
